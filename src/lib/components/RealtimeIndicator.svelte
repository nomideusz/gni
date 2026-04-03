<svelte:options runes={true} />

<script lang="ts">
	import Radio from 'lucide-svelte/icons/radio';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import { realtimeStore, setupRealtime, onRealtimeRefresh, manualRefresh } from '$lib/realtime';
	import { onMount, onDestroy } from 'svelte';
	import { formatDateTime } from '$lib/pocketbase';

	interface SyncingInfo {
		currentLayer: string | null;
		completedLayers: number;
		totalLayers: number;
	}

	interface SyncInfoData {
		last_sync?: string;
		last_sync_success?: string;
		sync_status?: string;
		syncing?: SyncingInfo;
	}

	interface Props {
		/** Called when real-time data arrives or manual refresh is clicked */
		onRefresh?: () => void;
		/** Optional sync info object from the API (ArcGIS → PocketBase sync time) */
		syncInfo?: SyncInfoData | null;
		/** Whether the current user is an admin */
		isAdmin?: boolean;
	}

	let { onRefresh, syncInfo = null, isAdmin = false }: Props = $props();

	// Local copy of syncInfo that we can update
	let localSyncInfo = $state<SyncInfoData | null>(null);

	// Quick sync state (admin only)
	let syncTriggering = $state(false);
	let syncTriggerMessage = $state<string | null>(null);

	// Keep localSyncInfo in sync with prop, and start polling if sync is in progress on load
	$effect(() => {
		if (syncInfo) {
			localSyncInfo = syncInfo;
			// If we loaded the page while a sync is running, start polling
			if (syncInfo.sync_status === 'in_progress' && !syncPollInterval) {
				const prevTime = syncInfo.last_sync || syncInfo.last_sync_success;
				startSyncPolling(prevTime);
			}
		}
	});

	let rtState = $state({ connected: false, eventCount: 0, lastEvent: null as string | null, lastEventTime: null as Date | null });
	let refreshing = $state(false);
	let unsubStore: (() => void) | undefined;
	let unsubRefresh: (() => void) | undefined;
	let syncTriggerTimeout: ReturnType<typeof setTimeout> | undefined;
	let syncPollInterval: ReturnType<typeof setInterval> | undefined;
	let isPolling = $state(false);

	onMount(() => {
		setupRealtime();

		unsubStore = realtimeStore.subscribe(s => {
			rtState = s;
		});

		if (onRefresh) {
			unsubRefresh = onRealtimeRefresh(() => {
				onRefresh();
				fetchSyncStatus();
			});
		}
	});

	onDestroy(() => {
		unsubStore?.();
		unsubRefresh?.();
		if (syncPollInterval) clearInterval(syncPollInterval);
	});

	async function fetchSyncStatus() {
		try {
			const res = await fetch('/api/v1/sync-status');
			if (res.ok) localSyncInfo = await res.json();
		} catch { /* ignore */ }
	}

	async function handleManualRefresh() {
		refreshing = true;
		if (onRefresh) {
			try { onRefresh(); } catch { /* */ }
		}
		manualRefresh();
		await fetchSyncStatus();
		setTimeout(() => { refreshing = false; }, 600);
	}

	// Derived: is a sync currently in progress (from API) or are we polling after a trigger?
	// Derived: is a sync currently in progress (from API) or are we polling after a trigger?
	const isSyncRunning = $derived(localSyncInfo?.sync_status === 'in_progress' || isPolling);

	/** Poll sync status until sync completes or timeout */
	function startSyncPolling(previousSyncTime: string | undefined) {
		if (syncPollInterval) clearInterval(syncPollInterval);
		isPolling = true;
		let elapsed = 0;
		const POLL_INTERVAL = 3000; // 3s for better progress updates
		const MAX_POLL_TIME = 300000; // 5 min

		syncPollInterval = setInterval(async () => {
			elapsed += POLL_INTERVAL;
			await fetchSyncStatus();

			// Update message with progress if available
			if (localSyncInfo?.syncing) {
				const s = localSyncInfo.syncing;
				syncTriggerMessage = `⏳ Syncing ${s.currentLayer || '...'} (${s.completedLayers}/${s.totalLayers})`;
			}

			const currentSync = localSyncInfo?.last_sync || localSyncInfo?.last_sync_success;
			const syncDone = localSyncInfo?.sync_status !== 'in_progress';
			const changed = currentSync && currentSync !== previousSyncTime;

			if (syncDone && changed) {
				clearInterval(syncPollInterval!);
				syncPollInterval = undefined;
				isPolling = false;
				syncTriggerMessage = '✅ Sync complete';
				if (onRefresh) onRefresh();
				if (syncTriggerTimeout) clearTimeout(syncTriggerTimeout);
				syncTriggerTimeout = setTimeout(() => { syncTriggerMessage = null; }, 5000);
			} else if (elapsed >= MAX_POLL_TIME) {
				clearInterval(syncPollInterval!);
				syncPollInterval = undefined;
				isPolling = false;
				syncTriggerMessage = '⏳ Sync still running — refresh manually later';
				if (syncTriggerTimeout) clearTimeout(syncTriggerTimeout);
				syncTriggerTimeout = setTimeout(() => { syncTriggerMessage = null; }, 8000);
			}
		}, POLL_INTERVAL);
	}

	async function handleTriggerSync(force: boolean) {
		syncTriggering = true;
		syncTriggerMessage = null;
		try {
			// Capture current sync time before triggering
			const previousSyncTime = localSyncInfo?.last_sync || localSyncInfo?.last_sync_success;

			const res = await fetch('/api/v1/trigger-sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ type: 'gni', force })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed');
			syncTriggerMessage = force ? '⏳ Full sync starting...' : '⚡ Quick sync starting...';
			// Start polling for progress and completion
			startSyncPolling(previousSyncTime);
		} catch (err) {
			syncTriggerMessage = '❌ ' + (err instanceof Error ? err.message : 'Failed');
			if (syncTriggerTimeout) clearTimeout(syncTriggerTimeout);
			syncTriggerTimeout = setTimeout(() => { syncTriggerMessage = null; }, 8000);
		} finally {
			syncTriggering = false;
		}
	}

	function getSyncTime(): string {
		const info = localSyncInfo;
		if (!info) return '';
		const ts = info.last_sync || info.last_sync_success;
		return ts ? formatDateTime(ts) : 'Never';
	}
</script>

<div class="rt">
	<!-- Live status pill -->
	<div class="rt__status" class:rt__status--connected={rtState.connected}>
		<Radio size={13} />
		<span class="rt__label">
			{#if rtState.connected}
				Live
				{#if rtState.eventCount > 0}
					<span class="rt__count">({rtState.eventCount})</span>
				{/if}
			{:else}
				Connecting…
			{/if}
		</span>
	</div>

	<!-- DB sync info (ArcGIS → PocketBase) -->
	{#if localSyncInfo}
		<div class="rt__sync" class:rt__sync--active={isSyncRunning} title="Last ArcGIS sync: {getSyncTime()}">
			{#if isSyncRunning && localSyncInfo.syncing}
				<span class="rt__sync-label">Syncing:</span>
				<span class="rt__sync-progress">
					{localSyncInfo.syncing.currentLayer || '...'}
					<span class="rt__sync-fraction">{localSyncInfo.syncing.completedLayers}/{localSyncInfo.syncing.totalLayers}</span>
				</span>
				<span class="rt__sync-badge rt__sync-badge--in_progress">syncing</span>
			{:else if isSyncRunning}
				<span class="rt__sync-label">Syncing...</span>
				<span class="rt__sync-badge rt__sync-badge--in_progress">syncing</span>
			{:else}
				<span class="rt__sync-label">DB sync:</span>
				<span class="rt__sync-time">{getSyncTime()}</span>
				<span class="rt__sync-badge rt__sync-badge--{localSyncInfo.sync_status || 'pending'}">
					{localSyncInfo.sync_status || 'Unknown'}
				</span>
			{/if}
		</div>
	{/if}

	{#if isAdmin}
		<!-- Admin: Quick Sync + Full Sync buttons -->
		<button
			class="rt__sync-btn rt__sync-btn--quick"
			onclick={() => handleTriggerSync(false)}
			title="Quick sync: fetch changes since last sync"
			disabled={syncTriggering || isSyncRunning}
		>
			⚡ Quick Sync
		</button>
		<button
			class="rt__sync-btn rt__sync-btn--full"
			onclick={() => handleTriggerSync(true)}
			title="Full sync: re-fetch ALL data from ArcGIS (takes a long time!)"
			disabled={syncTriggering || isSyncRunning}
		>
			🔄 Full Sync
		</button>

		{#if syncTriggerMessage}
			<span class="rt__trigger-msg">{syncTriggerMessage}</span>
		{/if}

		<!-- Manual data refresh -->
		<button
			class="rt__refresh"
			class:rt__refresh--spinning={refreshing}
			onclick={handleManualRefresh}
			title="Refresh dashboard data"
			disabled={refreshing}
		>
			<RefreshCw size={14} />
		</button>
	{/if}
</div>

<style>
	.rt {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
	}

	/* Live status pill */
	.rt__status {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.65rem;
		border-radius: 20px;
		font-weight: 600;
		background: rgba(107, 114, 128, 0.1);
		color: var(--color-text-secondary, #6b7280);
		border: 1px solid rgba(107, 114, 128, 0.2);
		transition: all 0.3s ease;
		white-space: nowrap;
	}

	.rt__status--connected {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
		border-color: rgba(34, 197, 94, 0.3);
	}

	.rt__count {
		opacity: 0.7;
		font-weight: 400;
	}

	/* DB sync info */
	.rt__sync {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.625rem;
		border-radius: 6px;
		background: var(--bg-secondary, #f9fafb);
		border: 1px solid var(--border-primary, #e5e7eb);
		white-space: nowrap;
		color: var(--color-text-secondary, #6b7280);
	}

	.rt__sync-label {
		font-weight: 500;
		opacity: 0.7;
	}

	.rt__sync-time {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.7rem;
	}

	.rt__sync-badge {
		padding: 0.1rem 0.35rem;
		border-radius: 10px;
		font-size: 0.6rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.rt__sync-badge--success {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
	}

	.rt__sync-badge--pending {
		background: rgba(245, 158, 11, 0.1);
		color: #d97706;
	}

	.rt__sync-badge--failed {
		background: rgba(239, 68, 68, 0.1);
		color: #dc2626;
	}

	.rt__sync-badge--in_progress {
		background: rgba(59, 130, 246, 0.1);
		color: #2563eb;
		animation: rt-pulse 1.5s ease-in-out infinite;
	}

	/* Syncing state */
	.rt__sync--active {
		border-color: rgba(59, 130, 246, 0.4);
		background: rgba(59, 130, 246, 0.05);
	}

	.rt__sync-progress {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.7rem;
		color: #2563eb;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rt__sync-fraction {
		opacity: 0.7;
		margin-left: 0.25rem;
	}

	/* Refresh button */
	.rt__refresh {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: 1px solid var(--border-primary, #e5e7eb);
		background: var(--bg-primary, #fff);
		color: var(--color-text-secondary, #6b7280);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.rt__refresh:hover {
		background: var(--bg-secondary, #f9fafb);
		color: var(--accent-primary, var(--accent-primary, #0d9488));
		border-color: var(--accent-primary, var(--accent-primary, #0d9488));
	}

	.rt__refresh:active {
		transform: scale(0.92);
	}

	/* Admin sync trigger buttons */
	.rt__sync-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		border: 1px solid var(--border-primary, #e5e7eb);
		background: var(--bg-primary, #fff);
		color: var(--color-text-secondary, #6b7280);
		cursor: pointer;
		font-size: 0.7rem;
		font-weight: 600;
		white-space: nowrap;
		transition: all 0.2s ease;
	}

	.rt__sync-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.rt__sync-btn--quick:hover:not(:disabled) {
		background: rgba(34, 197, 94, 0.1);
		border-color: #16a34a;
		color: #16a34a;
	}

	.rt__sync-btn--full:hover:not(:disabled) {
		background: rgba(245, 158, 11, 0.1);
		border-color: #d97706;
		color: #d97706;
	}

	.rt__trigger-msg {
		font-size: 0.7rem;
		white-space: nowrap;
		color: var(--color-text-secondary, #6b7280);
		animation: rt-fade-in 0.3s ease;
	}

	@keyframes rt-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.rt__refresh--spinning {
		pointer-events: none;
	}

	.rt__refresh--spinning :global(svg) {
		animation: rt-spin 0.6s linear infinite;
	}

	@keyframes rt-spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	@keyframes rt-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	@media (max-width: 768px) {
		.rt__sync {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.rt__sync-btn {
			display: none;
		}
	}
</style>
