<script lang="ts">
	import { Download } from 'lucide-svelte';

	// Props interface
	interface Props {
		selectedReports?: Set<string>;
		reportFilter?: string;
		includeSurveysOnly?: boolean;
		displayedReports?: any[];
		onClearSelections?: () => void;
		onExport?: () => void;
	}

	let { 
		selectedReports = new Set(),
		reportFilter = 'final',
		includeSurveysOnly = true,
		displayedReports = [],
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


</style> 