<script lang="ts">
	import { Download, RefreshCw } from 'lucide-svelte';
	import { formatDateTime } from '$lib/pocketbase';

	// Props interface
	interface Props {
		selectedReports?: Set<string>;
		reportFilter?: string;
		includeSurveysOnly?: boolean;
		displayedReports?: any[];
		syncInfo?: any;
		onClearSelections?: () => void;
		onExport?: () => void;
	}

	let { 
		selectedReports = new Set(),
		reportFilter = 'final',
		includeSurveysOnly = true,
		displayedReports = [],
		syncInfo = null,
		onClearSelections,
		onExport
	}: Props = $props();
</script>

<div class="export-controls">
	{#if selectedReports.size > 0}
		<div class="selection-info">
			<span class="selection-count">
				{selectedReports.size} 
				{reportFilter === 'final' ? 'final' : 
				 reportFilter === 'draft' ? 'draft' : 
				 reportFilter === 'final-and-draft' ? 'final & draft' : ''} 
				{selectedReports.size === 1 ? 'report' : 'reports'} selected
			</span>
			<button 
				class="button button--secondary button--small" 
				onclick={onClearSelections}
			>
				Clear Selection
			</button>
		</div>
	{/if}
	<button 
		class="button button--primary" 
		onclick={onExport}
	>
		<Download size={18} />
		{#if selectedReports.size > 0}
			Export Selected {reportFilter === 'final' ? 'Final' : 
							 reportFilter === 'draft' ? 'Draft' : 
							 reportFilter === 'final-and-draft' ? 'Final & Draft' : ''} 
			({selectedReports.size})
			{#if !includeSurveysOnly}<span class="export-note">(All Reports)</span>{/if}
		{:else}
			Export All {reportFilter === 'final' ? 'Final' : 
						reportFilter === 'draft' ? 'Draft' : 
						reportFilter === 'final-and-draft' ? 'Final & Draft' : ''} 
			({displayedReports.length})
			{#if !includeSurveysOnly}<span class="export-note">(All Reports)</span>{/if}
		{/if}
	</button>
</div>

{#if syncInfo}
	<div class="sync-info">
		<RefreshCw size={16} class="sync-info__icon" />
		<span class="sync-info__text">
			Last synced: {syncInfo.last_sync
				? formatDateTime(syncInfo.last_sync)
				: syncInfo.last_sync_success
					? formatDateTime(syncInfo.last_sync_success)
					: 'Never'}
		</span>
		<span class="sync-info__status sync-info__status--{syncInfo.sync_status || 'pending'}">
			{syncInfo.sync_status || 'Unknown'}
		</span>
	</div>
{/if}

<style>
	/* Export Controls */
	.export-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.export-note {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 400;
	}

	.selection-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.selection-count {
		font-weight: 600;
		color: var(--accent-primary);
	}

	.button--small {
		padding: 0.375rem 0.75rem;
		font-size: 0.8rem;
	}

	/* Sync Info */
	.sync-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
		background: var(--bg-secondary);
		padding: 0.625rem 1rem;
		border-radius: 4px;
		border: 1px solid var(--border-primary);
	}

	.sync-info__icon {
		opacity: 0.7;
	}

	.sync-info__text {
		white-space: nowrap;
	}

	.sync-info__status {
		padding: 0.125rem 0.375rem;
		border-radius: 12px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}

	.sync-info__status--success {
		background: rgba(34, 197, 94, 0.1);
		color: var(--success);
	}

	.sync-info__status--pending {
		background: rgba(245, 158, 11, 0.1);
		color: var(--warning);
	}

	.sync-info__status--failed {
		background: rgba(239, 68, 68, 0.1);
		color: var(--error);
	}
</style> 