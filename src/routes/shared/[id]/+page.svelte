<script lang="ts">
	import { SplitPane } from '$lib';
	import { resource } from 'runed';
	import LineChart from '$lib/components/LineChart.svelte';
	import ScatterChart from '$lib/components/ScatterChart.svelte';
	import DualAxisChart from '$lib/components/DualAxisChart.svelte';
	import WindRoseChart from '$lib/components/WindRoseChart.svelte';
	import type { PageData } from './$types';
	
	// Define data structure for DAT files
	interface DataItem {
		EPOCH_TIME: number;
		[key: string]: number | string;
	}
	
	let { data }: { data: PageData } = $props();
	
	// State for tracking hovered point across charts
	let sharedHoveredPoint = $state<DataItem | null>(null);
	
	// Flag to show/hide visualizations
	let showVisualizations = $state(true);
	
	// Use resource for reactive data fetching (same pattern as survey-viewer)
	const dataResource = resource(
		() => ({ sharedFile: data.sharedFile }),
		async (source, prevSource, { signal }) => {
			// Handle shared file data
			if (source.sharedFile && source.sharedFile.data) {
				return {
					data: source.sharedFile.data,
					columns: source.sharedFile.columns
				};
			}
			
			// If no data is available yet, return empty structure
			return { data: [], columns: [] };
		},
		{
			initialValue: { data: [], columns: [] }
		}
	);
	
	// CH4 statistics
	let minCH4 = $derived(dataResource.current.data.length > 0 ? 
		Math.min(...dataResource.current.data.map((d: DataItem) => d.CH4 as number)) : 0);
	let maxCH4 = $derived(dataResource.current.data.length > 0 ? 
		Math.max(...dataResource.current.data.map((d: DataItem) => d.CH4 as number)) : 0);
	let averageCH4 = $derived(dataResource.current.data.length > 0 ?
		dataResource.current.data.reduce((sum: number, d: DataItem) => sum + (d.CH4 as number), 0) / 
		dataResource.current.data.length : 0);
	
	// C2H6 statistics
	let minC2H6 = $derived(dataResource.current.data.length > 0 ?
		Math.min(...dataResource.current.data.map((d: DataItem) => d.C2H6 as number)) : 0);
	let maxC2H6 = $derived(dataResource.current.data.length > 0 ?
		Math.max(...dataResource.current.data.map((d: DataItem) => d.C2H6 as number)) : 0);
	let averageC2H6 = $derived(dataResource.current.data.length > 0 ?
		dataResource.current.data.reduce((sum: number, d: DataItem) => sum + (d.C2H6 as number), 0) / 
		dataResource.current.data.length : 0);
	
	// Get shared file for template usage
	let sharedFile = $derived(data.sharedFile);
	
	// Toggle visualizations
	function toggleVisualizations() {
		showVisualizations = !showVisualizations;
	}
	
	// Update sharedHoveredPoint when chart reports a hover
	function handleChartHover(point: DataItem | null) {
		sharedHoveredPoint = point;
	}
</script>

<div class="shared-page">
	<header class="shared-header">
		<div class="header-content">
			<h1>Shared Survey Data</h1>
			<p class="description">Viewing shared survey data file</p>
		</div>
		{#if !dataResource.loading && !dataResource.error && dataResource.current.data.length > 0}
			<div class="header-actions">
				<button class="button button--primary" onclick={toggleVisualizations}>
					{showVisualizations ? 'Hide Charts' : 'Show Charts'}
				</button>
			</div>
		{/if}
	</header>

	<main class="shared-content">
		{#if !dataResource.loading && !dataResource.error && dataResource.current.data.length > 0}
			<section class="file-section">
				<h2>File Information</h2>
				<div class="file-header">
					<div class="file-info">
						<h3 class="file-name">{sharedFile.filename}</h3>
						{#if dataResource.current.data.length > 0}
							<div class="timestamp">
								<span class="timestamp-icon">⏱️</span> 
								{new Date(dataResource.current.data[0]?.EPOCH_TIME * 1000).toLocaleString()} 
								<span class="timestamp-separator">→</span> 
								{new Date(dataResource.current.data[dataResource.current.data.length-1]?.EPOCH_TIME * 1000).toLocaleString()}
							</div>
						{/if}
						<div class="shared-info">
							<span class="shared-icon">🔗</span>
							Shared on {new Date(sharedFile.createdAt).toLocaleString()}
						</div>
					</div>
				</div>
			</section>

			<section class="stats-section">
				<h2>Data Statistics</h2>
					<div class="dashboard-stats">
						<!-- File Information -->
						<article class="stat-card">
							<div class="stat-card__icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<polyline points="12,6 12,12 16,14"/>
								</svg>
							</div>
							<div class="stat-card__content">
								<h3 class="stat-card__title">Data Points</h3>
								<div class="stat-card__value">{dataResource.current.data.length.toLocaleString()}</div>
							</div>
						</article>

						<article class="stat-card">
							<div class="stat-card__icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<polyline points="12,6 12,12 16,14"/>
								</svg>
							</div>
							<div class="stat-card__content">
								<h3 class="stat-card__title">Duration</h3>
								<div class="stat-card__value">
									{dataResource.current.data.length > 0 ? 
										((dataResource.current.data[dataResource.current.data.length-1].EPOCH_TIME - 
										dataResource.current.data[0].EPOCH_TIME) / 60).toFixed(2) + ' min' : 
										'N/A'}
								</div>
							</div>
						</article>

						<!-- CH₄ Statistics -->
						<article class="stat-card">
							<div class="stat-card__icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 3v18h18"/>
									<path d="M7 12l4-4 4 4 6-6"/>
								</svg>
							</div>
							<div class="stat-card__content">
								<h3 class="stat-card__title">CH₄ Minimum</h3>
								<div class="stat-card__value">{minCH4.toFixed(2)} ppm</div>
							</div>
						</article>

						<article class="stat-card">
							<div class="stat-card__icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 3v18h18"/>
									<path d="M7 16l4-4 4 4 6-6"/>
								</svg>
							</div>
							<div class="stat-card__content">
								<h3 class="stat-card__title">CH₄ Average</h3>
								<div class="stat-card__value">{averageCH4.toFixed(2)} ppm</div>
							</div>
						</article>

						<article class="stat-card">
							<div class="stat-card__icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 3v18h18"/>
									<path d="M7 8l4-4 4 4 6-6"/>
								</svg>
							</div>
							<div class="stat-card__content">
								<h3 class="stat-card__title">CH₄ Maximum</h3>
								<div class="stat-card__value">{maxCH4.toFixed(2)} ppm</div>
							</div>
						</article>

						<!-- C₂H₆ Statistics -->
						<article class="stat-card">
							<div class="stat-card__icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 3v18h18"/>
									<path d="M7 12l4-4 4 4 6-6"/>
								</svg>
							</div>
							<div class="stat-card__content">
								<h3 class="stat-card__title">C₂H₆ Minimum</h3>
								<div class="stat-card__value">{minC2H6.toFixed(3)} ppm</div>
							</div>
						</article>

						<article class="stat-card">
							<div class="stat-card__icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 3v18h18"/>
									<path d="M7 16l4-4 4 4 6-6"/>
								</svg>
							</div>
							<div class="stat-card__content">
								<h3 class="stat-card__title">C₂H₆ Average</h3>
								<div class="stat-card__value">{averageC2H6.toFixed(3)} ppm</div>
							</div>
						</article>

						<article class="stat-card">
							<div class="stat-card__icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 3v18h18"/>
									<path d="M7 8l4-4 4 4 6-6"/>
								</svg>
							</div>
							<div class="stat-card__content">
								<h3 class="stat-card__title">C₂H₆ Maximum</h3>
								<div class="stat-card__value">{maxC2H6.toFixed(3)} ppm</div>
							</div>
						</article>
					</div>
			</section>

			
			<!-- Visualizations Section -->
			{#if showVisualizations}
				<section class="visualizations-section">
					<h2>Data Visualizations</h2>
						<div class="charts-grid">
							<SplitPane type="vertical" min="30%" max="70%" pos="50%" --color="var(--border-primary)" --thickness="4px">
								{#snippet a()}
									<!-- Top charts -->
									<SplitPane 
										type="horizontal" 
										min="30%" 
										max="70%" 
										pos="50%" 
										--color="var(--border-primary)" 
										--thickness="4px"
										--handle-position="relative"
									>
										{#snippet a()}
											<!-- Methane Chart -->
											<div class="chart-panel">
												<div class="chart-card">
													<h3>Methane (CH₄) Concentration</h3>
													<div class="chart-wrapper">
														<LineChart 
															dataSource={dataResource.current.data}
															yColumn="CH4"
															xAxisLabel="Time"
															yAxisLabel="ppm"
															title="CH₄ over Time"
															color="#38bdf8"
															includeZero={false}
															padding={0.15}
															topPadding={0.3}
															colorGradient={true}
															colorColumn="CH4"
															minColor="#38bdf8"
															maxColor="#ff3333"
															showDataPoints={false}
															lineWidth={2.5}
															hoveredPoint={sharedHoveredPoint}
															on:hoverPoint={(e) => handleChartHover(e.detail)}
														/>
													</div>
												</div>
											</div>
										{/snippet}
										
										{#snippet b()}
											<!-- GPS Scatter Plot -->
											<div class="chart-panel">
												<div class="chart-card">
													<h3>GPS Trace with CH₄ Levels</h3>
													<div class="chart-wrapper">
														<ScatterChart 
															dataSource={dataResource.current.data}
															xColumn="GPS_ABS_LONG"
															yColumn="GPS_ABS_LAT"
															xAxisLabel="Longitude" 
															yAxisLabel="Latitude"
															title="GPS Trace"
															color="#38bdf8"
															lineColor="#888888"
															lineOpacity={0.5}
															lineWidth={1.5}
															dotSizeColumn="CH4"
															minDotSize={4}
															maxDotSize={12}
															colorColumn="CH4"
															minColor="#38bdf8"
															maxColor="#ff3333"
															subsample={3}
															padding={0.03}
															showKmScale={true}
															showGrid={true}
															gridColor="#9ca3af"
															gridOpacity={0.65}
															gridDotSpacing={10}
															preserveAspectRatio={true}
															showWindArrow={true}
															windNColumn="WIND_N"
															windEColumn="WIND_E"
															arrowColor="#2563eb"
															arrowSize={50}
															hoveredPoint={sharedHoveredPoint}
															on:hoverPoint={(e) => handleChartHover(e.detail)}
														/>
														
														<!-- Wind Rose Chart Overlay -->
														<div class="wind-rose-overlay">
															<div class="wind-rose-container">
																<WindRoseChart 
																	dataSource={dataResource.current.data}
																	windNColumn="WIND_N"
																	windEColumn="WIND_E"
																	title="Wind Distribution"
																	colorScale={['#d0f0fd', '#94d8fb', '#4a9ff9', '#1d6feb', '#0143eb']}
																	segmentCount={16}
																	speedBins={5}
																	hoveredPoint={sharedHoveredPoint}
																	compact={true}
																/>
															</div>
														</div>
													</div>
												</div>
											</div>
										{/snippet}
									</SplitPane>
								{/snippet}
								
								{#snippet b()}
									<!-- Bottom section -->
									<div class="chart-panel">
										<div class="chart-card">
											<h3>CH₄ and C₂H₆ Comparison</h3>
											<div class="chart-wrapper">
												<DualAxisChart 
													dataSource={dataResource.current.data}
													xColumn="EPOCH_TIME"
													leftYColumn="CH4"
													rightYColumn="C2H6"
													leftYLabel="CH₄ (ppm)"
													rightYLabel="C₂H₆ (ppm)"
													leftColor="#38bdf8"
													rightColor="#f97316"
													title="Dual Gas Analysis"
													xAxisLabel="Time"
													tooltipTimeLabel="Time"
													tooltipUnitMultiplier={1000}
												/>
											</div>
										</div>
									</div>
								{/snippet}
							</SplitPane>
						</div>
				</section>
			{/if}
		{:else if dataResource.loading}
			<section class="loading-section">
				<h2>Loading</h2>
				<div class="loading-state">
					<div class="loading-spinner"></div>
					<p>Loading shared data... Please wait.</p>
				</div>
			</section>
		{:else if dataResource.error}
			<section class="error-section">
				<h2>Error</h2>
				<div class="error-state">
					<div class="error-icon">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10"/>
							<line x1="15" y1="9" x2="9" y2="15"/>
							<line x1="9" y1="9" x2="15" y2="15"/>
						</svg>
					</div>
					<p>Error: {dataResource.error?.message || 'Unknown error'}</p>
				</div>
			</section>
		{:else}
			<section class="empty-section">
				<h2>No Data Available</h2>
				<div class="empty-state">
					<div class="empty-icon">📊</div>
					<h3>No Data Available</h3>
					<p>This shared file could not be loaded or contains no data</p>
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	@import '$lib/styles/theme.css';
	@import '$lib/styles/buttons.css';
	@import '$lib/styles/cards.css';
	@import '$lib/styles/ui-components.css';

	/* Ensure proper scrolling behavior */
	:global(html, body) {
		overflow: auto !important;
		height: auto !important;
		position: static !important;
	}

	.shared-page {
		background-color: var(--bg-primary);
		color: var(--text-primary);
		overflow: auto;
		min-height: 100vh;
	}

	.shared-header {
		background-color: var(--bg-secondary);
		border-bottom: 1px solid var(--border-primary);
		padding: var(--space-lg) var(--space-xl);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-lg);
	}

	.header-content h1 {
		margin: 0 0 var(--space-xs) 0;
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.description {
		margin: 0;
		color: var(--text-secondary);
		font-size: 1rem;
	}

	.header-actions {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.shared-content {
		width: 100%;
		padding: var(--space-xl);
	}

	section {
		background-color: var(--bg-secondary);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		margin-bottom: var(--space-lg);
		border: 1px solid var(--border-primary);
	}

	section h2 {
		margin: 0;
		padding: var(--space-lg) var(--space-lg) 0 var(--space-lg);
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.file-header {
		margin-bottom: var(--space-lg);
		padding: var(--space-lg);
	}

	.file-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.file-name {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.timestamp {
		font-size: 0.875rem;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.timestamp-separator {
		margin: 0 var(--space-sm);
		color: var(--text-secondary);
		opacity: 0.6;
	}

	.shared-info {
		font-size: 0.875rem;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.shared-icon {
		font-size: 1rem;
	}

	.action-group {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	/* Compact statistics cards */
	.dashboard-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
	}

	.dashboard-stats .stat-card {
		padding: var(--space-xs) var(--space-sm);
		min-height: auto;
	}

	.dashboard-stats .stat-card__icon {
		display: none;
	}

	.dashboard-stats .stat-card__title {
		font-size: 0.8rem;
		margin-bottom: var(--space-xs);
		line-height: 1.2;
	}

	.dashboard-stats .stat-card__value {
		font-size: 1.1rem;
		font-weight: 600;
		line-height: 1.1;
	}



	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: calc(var(--space-xl) * 2);
		text-align: center;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: var(--space-md);
	}

	.empty-state h3 {
		margin: 0 0 var(--space-sm) 0;
		font-size: 1.25rem;
		color: var(--text-primary);
	}

	.empty-state p {
		color: var(--text-secondary);
		max-width: 400px;
	}

	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		margin-top: var(--space-md);
		padding: var(--space-lg);
		background-color: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.2);
		border-radius: var(--radius-md);
	}

	.loading-state p {
		margin: 0;
		color: var(--accent-secondary);
		font-size: 0.875rem;
	}

	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(59, 130, 246, 0.3);
		border-top: 2px solid var(--accent-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.error-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		margin-top: var(--space-md);
		padding: var(--space-lg);
		background-color: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: var(--radius-md);
	}

	.error-state p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
		opacity: 0.8;
	}

	.error-icon {
		color: var(--error);
		flex-shrink: 0;
	}
	
	/* Visualization styles */
	.charts-grid {
		height: 70vh;
		min-height: 500px;
		margin-bottom: var(--space-md);
	}
	
	.chart-panel {
		height: 100%;
		width: 100%;
		padding: var(--space-xs);
		overflow: hidden;
		box-sizing: border-box;
		display: flex;
	}
	
	.chart-card {
		background-color: var(--bg-secondary);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		padding: var(--space-sm) var(--space-sm);
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-sizing: border-box;
		border: 1px solid var(--border-primary);
	}
	
	.chart-card h3 {
		margin: 0 0 var(--space-xs) 0;
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--text-primary);
		flex-shrink: 0;
		line-height: 1.2;
	}
	
	.chart-wrapper {
		flex: 1;
		min-height: 0;
		position: relative;
		overflow: hidden;
	}
	
	/* Wind Rose Overlay */
	.wind-rose-overlay {
		position: absolute;
		top: 0px;
		right: var(--space-sm);
		width: 18%;
		height: 18%;
		min-width: 65px;
		min-height: 65px;
		max-width: 110px;
		max-height: 110px;
		background-color: rgba(22, 22, 31, 0.9);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		z-index: 10;
		overflow: hidden;
		border: 1px solid var(--border-primary);
		transition: all var(--transition-normal) ease;
		opacity: 1;
	}
	
	.wind-rose-container {
		width: 100%;
		height: 100%;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style> 