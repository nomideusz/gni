<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle } from 'lucide-svelte';

	// Props
	interface Props {
		show?: boolean;
		reportName?: string;
		indications?: any[];
		onClose?: () => void;
	}

	let { show = $bindable(false), reportName = '', indications = [], onClose }: Props = $props();

	// Handle keyboard events for modal
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && show) {
			handleClose();
		}
	}

	function handleClose() {
		show = false;
		if (onClose) {
			onClose();
		}
	}

	// Handle clicking outside modal
	function handleOverlayClick() {
		handleClose();
	}

	function handleContentClick(event: MouseEvent) {
		event.stopPropagation();
	}

	// Add keyboard event listener
	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if show}
	<div 
		class="modal-overlay" 
		role="button" 
		tabindex="0" 
		onclick={handleOverlayClick}
		onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? handleOverlayClick() : null} 
		aria-label="Close modal"
	>
		<div 
			class="modal-content" 
			role="dialog" 
			tabindex="-1" 
			aria-labelledby="modal-title" 
			onclick={handleContentClick}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<h3 id="modal-title">LISA Indications - {reportName}</h3>
				<button class="modal-close" onclick={handleClose}>×</button>
			</div>
			<div class="modal-body">
				{#if indications.length === 0}
					<div class="no-indications">
						<AlertTriangle size={48} class="no-indications-icon" />
						<h4>No LISA Indications Found</h4>
						<p>This report does not contain any LISA indications.</p>
					</div>
				{:else}
					<div class="indications-list">
						{#each indications as indication, index}
							{@const confidence = Number(indication.classification_confidence || 0)}
							{@const emissionRate = Number(indication.emission_rate || 0)}
							{@const amplitude = Number(indication.amplitude || 0)}
							
							<div class="indication-card {confidence > 0.8 ? 'indication-card--high-confidence' : confidence > 0.6 ? 'indication-card--medium-confidence' : 'indication-card--low-confidence'}">
								<div class="indication-header">
									<div class="indication-title">
										<span class="indication-number">#{index + 1}</span>
										{#if indication.lisa_name}
											<div class="indication-id-section">
												<span class="indication-name">{indication.lisa_name}</span>
											</div>
										{/if}
									</div>
									<div class="indication-badges">
										{#if indication.rfr_label}
											<span class="emission-badge">Emission Bin: {indication.rfr_label}</span>
										{/if}
									</div>
								</div>
								
								<div class="indication-content">
									<!-- Primary Metrics -->
									<div class="metric-group metric-group--primary">
										<div class="metrics-grid">
											{#if indication.amplitude}
												<div class="metric-card">
													<div class="metric-content">
														<span class="metric-label">Amplitude</span>
														<span class="metric-value metric-value--{amplitude > 20 ? 'high' : amplitude > 10 ? 'medium' : 'low'}">{amplitude.toFixed(3)} <span class="metric-unit">ppm</span></span>
													</div>
												</div>
											{/if}
											
											{#if indication.classification_confidence}
												<div class="metric-card">
													<div class="metric-content">
														<span class="metric-label">Confidence</span>
														<div class="metric-value-with-bar">
															<span class="metric-value">{(confidence * 100).toFixed(1)}%</span>
															<div class="confidence-bar">
																<div class="confidence-fill confidence-fill--{confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low'}" style="width: {confidence * 100}%"></div>
															</div>
														</div>
													</div>
												</div>
											{/if}
											
											{#if indication.emission_rate}
												<div class="metric-card">
													<div class="metric-content">
														<span class="metric-label">Emission Rate</span>
														<span class="metric-value metric-value--{emissionRate > 1 ? 'high' : emissionRate > 0.5 ? 'medium' : 'low'}">{emissionRate.toFixed(3)} <span class="metric-unit">SCFH</span></span>
													</div>
												</div>
											{/if}
											
											{#if indication.num_peaks}
												<div class="metric-card">
													<div class="metric-content">
														<span class="metric-label">Number of Peaks</span>
														<span class="metric-value">{indication.num_peaks}</span>
													</div>
												</div>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.modal-content {
		background: var(--bg-primary);
		border-radius: 12px;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		max-width: 1200px;
		width: 95vw;
		max-height: 80vh;
		overflow: hidden;
		border: 1px solid var(--border-primary);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-primary);
		background: var(--bg-secondary);
	}

	.modal-header h3 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--text-secondary);
		padding: 0.25rem;
		border-radius: 4px;
		transition: color 0.2s ease;
	}

	.modal-close:hover {
		color: var(--text-primary);
		background-color: var(--bg-primary);
	}

	.modal-body {
		padding: 1.5rem;
		max-height: 60vh;
		overflow-y: auto;
	}

	.no-indications {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		color: var(--text-secondary);
		padding: 3rem 2rem;
		gap: 1rem;
	}

	.no-indications h4 {
		color: var(--text-primary);
		margin: 0;
		font-size: 1.125rem;
	}

	.no-indications p {
		margin: 0;
		opacity: 0.8;
	}

	:global(.no-indications-icon) {
		color: var(--text-secondary);
		opacity: 0.6;
	}

	.indications-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.indication-card {
		border: 1px solid var(--border-primary);
		border-radius: 12px;
		overflow: hidden;
		background: var(--bg-primary);
		transition: all 0.3s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
	}

	.indication-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
	}

	.indication-card--high-confidence {
		border-left: 4px solid var(--success);
	}

	.indication-card--medium-confidence {
		border-left: 4px solid var(--warning);
	}

	.indication-card--low-confidence {
		border-left: 4px solid var(--error);
	}

	.indication-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1rem 1rem 0.75rem;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-primary);
	}

	.indication-title {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.indication-number {
		background: var(--accent-primary);
		color: white;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		min-width: 2.5rem;
		text-align: center;
	}

	.indication-id-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.indication-name {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.indication-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.emission-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 600;
		background: rgba(var(--accent-primary-rgb), 0.15);
		color: var(--accent-primary);
		border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
	}

	.indication-content {
		padding: 1rem;
	}

	.metric-group {
		margin-bottom: 1rem;
	}

	.metric-group:last-child {
		margin-bottom: 0;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	.metric-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.metric-card:hover {
		border-color: var(--accent-primary);
		transform: translateY(-1px);
	}

	.metric-content {
		flex: 1;
		min-width: 0;
	}

	.metric-label {
		display: block;
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 0.25rem;
	}

	.metric-value {
		display: block;
		font-weight: 600;
		color: var(--text-primary);
		font-size: 1rem;
	}

	.metric-value--high {
		color: var(--error);
	}

	.metric-value--medium {
		color: var(--warning);
	}

	.metric-value--low {
		color: white;
	}

	.metric-unit {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 400;
	}

	.metric-value-with-bar {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.confidence-bar {
		width: 100%;
		height: 4px;
		background: var(--border-primary);
		border-radius: 2px;
		overflow: hidden;
	}

	.confidence-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.confidence-fill--high {
		background: var(--success);
	}

	.confidence-fill--medium {
		background: var(--warning);
	}

	.confidence-fill--low {
		background: var(--error);
	}
</style> 