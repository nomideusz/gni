<svelte:options runes={true} />

<script lang="ts">
	import Radio from 'lucide-svelte/icons/radio';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import { realtimeStore, setupRealtime, onRealtimeRefresh, manualRefresh } from '$lib/realtime';
	import { onMount, onDestroy } from 'svelte';
	import { formatDateTime } from '$lib/pocketbase';

	interface Props {
		/** Called when real-time data arrives or manual refresh is clicked */
		onRefresh?: () => void;
		/** Optional sync info object from the API (ArcGIS → PocketBase sync time) */
		syncInfo?: { last_sync?: string; last_sync_success?: string; sync_status?: string } | null;
	}

	let { onRefresh, syncInfo = null }: Props = $props();

	// Local copy of syncInfo that we can update
	let localSyncInfo = $state<typeof syncInfo>(null);

	// Track when UI data was last refreshed (manual or auto)
	let lastRefreshed = $state<Date | null>(new Date());

	// Keep localSyncInfo in sync with prop
	$effect(() => {
		if (syncInfo) localSyncInfo = syncInfo;
	});

	let rtState = $state({ connected: false, eventCount: 0, lastEvent: null as string | null, lastEventTime: null as Date | null });
	let refreshing = $state(false);
	let unsubStore: (() => void) | undefined;
	let unsubRefresh: (() => void) | undefined;

	onMount(() => {
		setupRealtime();

		unsubStore = realtimeStore.subscribe(s => {
			rtState = s;
		});

		if (onRefresh) {
			unsubRefresh = onRealtimeRefresh(() => {
				onRefresh();
				lastRefreshed = new Date();
				fetchSyncStatus();
			});
		}
	});

	onDestroy(() => {
		unsubStore?.();
		unsubRefresh?.();
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
		lastRefreshed = new Date();
		await fetchSyncStatus();
		setTimeout(() => { refreshing = false; }, 600);
	}

	function formatTime(date: Date | null): string {
		if (!date) return '';
		return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

	<!-- Last refreshed time (updates on manual refresh + auto refresh) -->
	{#if lastRefreshed}
		<div class="rt__refreshed" title="Data last loaded at {formatTime(lastRefreshed)}">
			<span class="rt__refreshed-label">Updated:</span>
			<span class="rt__refreshed-time">{formatTime(lastRefreshed)}</span>
		</div>
	{/if}

	<!-- DB sync info (ArcGIS → PocketBase) -->
	{#if localSyncInfo}
		<div class="rt__sync" title="Last ArcGIS sync: {getSyncTime()}">
			<span class="rt__sync-label">DB sync:</span>
			<span class="rt__sync-time">{getSyncTime()}</span>
			<span class="rt__sync-badge rt__sync-badge--{localSyncInfo.sync_status || 'pending'}">
				{localSyncInfo.sync_status || 'Unknown'}
			</span>
		</div>
	{/if}

	<!-- Manual refresh button -->
	<button
		class="rt__refresh"
		class:rt__refresh--spinning={refreshing}
		onclick={handleManualRefresh}
		title="Refresh data"
		disabled={refreshing}
	>
		<RefreshCw size={14} />
	</button>
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

	/* Last refreshed time */
	.rt__refreshed {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.625rem;
		border-radius: 6px;
		background: var(--bg-secondary, #f9fafb);
		border: 1px solid var(--border-primary, #e5e7eb);
		white-space: nowrap;
		color: var(--color-text-secondary, #6b7280);
	}

	.rt__refreshed-label {
		font-weight: 500;
		opacity: 0.7;
	}

	.rt__refreshed-time {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.7rem;
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
		.rt__refreshed {
			display: none;
		}
	}
</style>
