<script lang="ts">
	import { t, language, SplitPane } from '$lib';
	import { resource, Context } from 'runed';
	import LineChart from '$lib/components/LineChart.svelte';
	import ScatterChart from '$lib/components/ScatterChart.svelte';
	import HistogramChart from '$lib/components/HistogramChart.svelte';
	import MultiLineChart from '$lib/components/MultiLineChart.svelte';
	import DataSelector from '$lib/components/DataSelector.svelte';
	import { onMount } from 'svelte';
	import DualAxisChart from '$lib/components/DualAxisChart.svelte';
	import WindRoseChart from '$lib/components/WindRoseChart.svelte';
	
	// Get dataFiles from DataSelector
	import { dataFiles, type DataFile } from '$lib/data/testData';
	
    // Set default data file path
    let dataFilePath = $state('/data/test1_12-05-2025-07-57-07_C_Analytics.dat');
    
    // Define data structure for DAT files
    interface DataItem {
        EPOCH_TIME: number;
        [key: string]: number | string;
    }
    
    // Create a Context for hover interactions shared across all chart components
    const chartHoverContext = new Context<DataItem | null>('chartHoverPoint');
    
    // Use resource for reactive data fetching
    const dataResource = resource(
        () => ({ path: dataFilePath }),
        async (source, prevSource, { signal }) => {
            console.log(`Fetching data from: ${source.path}`);
            
            // Handle server file
            const response = await fetch(source.path, { signal });
            
            if (!response.ok) {
                throw new Error(`Failed to load data file: ${response.status} ${response.statusText}`);
            }
            
            const text = await response.text();
            
            if (!text || text.trim() === '') {
                throw new Error('File is empty or contains no data');
            }
            
            return parseDataText(text);
        },
        {
            initialValue: { data: [], columns: [] }
        }
    );
    
    // Parse DAT file contents
    function parseDataText(text: string) {
        const lines = text.trim().split('\n');
        
        if (lines.length < 2) {
            throw new Error('File does not contain enough data (needs header + at least one row)');
        }
        
        // Parse header row to get column names
        const columns = lines[0].trim().split(/\s+/);
        
        // Parse data rows
        const parsedData = lines.slice(1).map(line => {
            const values = line.trim().split(/\s+/);
            const item: any = {};
            
            // Map each value to its column name
            columns.forEach((col, index) => {
                item[col] = index < values.length ? parseFloat(values[index]) : null;
            });
            
            return item as DataItem;
        });
        
        return {
            data: parsedData,
            columns: columns
        };
    }
    
    // Create scaled data for C2H6
    let scaledDataResource = $derived({
        data: dataResource.current.data.map(item => ({
            ...item,
            C2H6_SCALED: (item.C2H6 as number) * 100
        })),
        columns: [...dataResource.current.columns, 'C2H6_SCALED'],
        loading: dataResource.loading,
        error: dataResource.error
    });
    
    // Calculate statistics for display in the info panel
    let selectedFile = $derived(dataFiles.find((file: DataFile) => file.path === dataFilePath) || dataFiles[0]);
    
    // CH4 statistics
    let minCH4 = $derived(Math.min(...dataResource.current.data.map(d => d.CH4 as number)));
    let maxCH4 = $derived(Math.max(...dataResource.current.data.map(d => d.CH4 as number)));
    let averageCH4 = $derived(
        dataResource.current.data.reduce((sum, d) => sum + (d.CH4 as number), 0) / 
        dataResource.current.data.length
    );
    
    // C2H6 statistics
    let minC2H6 = $derived(Math.min(...dataResource.current.data.map(d => d.C2H6 as number)));
    let maxC2H6 = $derived(Math.max(...dataResource.current.data.map(d => d.C2H6 as number)));
    let averageC2H6 = $derived(
        dataResource.current.data.reduce((sum, d) => sum + (d.C2H6 as number), 0) / 
        dataResource.current.data.length
    );
    
    // Speed statistics
    let maxSpeed = $derived(Math.max(...dataResource.current.data.map(d => d.CAR_SPEED as number)));
    let averageSpeed = $derived(
        dataResource.current.data.reduce((sum, d) => sum + (d.CAR_SPEED as number), 0) / 
        dataResource.current.data.length
    );
    let minSpeed = $derived(Math.min(...dataResource.current.data.map(d => d.CAR_SPEED as number)));
    
    // Calculate average wind speed
    function calculateAverageWind() {
        let sum = 0;
        let count = 0;
        
        for (const d of dataResource.current.data) {
            const windN = d.WIND_N as number;
            const windE = d.WIND_E as number;
            
            if (!isNaN(windN) && !isNaN(windE)) {
                // Calculate wind magnitude
                const magnitude = Math.sqrt(windN * windN + windE * windE);
                sum += magnitude;
                count++;
            }
        }
        
        return count > 0 ? sum / count : 0;
    }
    
    // Calculate min wind speed
    function calculateMinWind() {
        let minWind = Infinity;
        
        for (const d of dataResource.current.data) {
            const windN = d.WIND_N as number;
            const windE = d.WIND_E as number;
            
            if (!isNaN(windN) && !isNaN(windE)) {
                const magnitude = Math.sqrt(windN * windN + windE * windE);
                if (magnitude < minWind) {
                    minWind = magnitude;
                }
            }
        }
        
        return minWind === Infinity ? 0 : minWind;
    }
    
    // Calculate max wind speed
    function calculateMaxWind() {
        let maxWind = 0;
        
        for (const d of dataResource.current.data) {
            const windN = d.WIND_N as number;
            const windE = d.WIND_E as number;
            
            if (!isNaN(windN) && !isNaN(windE)) {
                const magnitude = Math.sqrt(windN * windN + windE * windE);
                if (magnitude > maxWind) {
                    maxWind = magnitude;
                }
            }
        }
        
        return maxWind;
    }
    
    // State for tracking hovered point with Context
    let sharedHoveredPoint = $state<DataItem | null>(null);
    
    // Initialize the context during component initialization
    onMount(() => {
        const updatePath = (event: CustomEvent<string>) => {
            dataFilePath = event.detail;
        };
        
        window.addEventListener('pathselected', updatePath as EventListener);
        
        // Initialize the hover context
        chartHoverContext.set(null);
        
        return () => {
            window.removeEventListener('pathselected', updatePath as EventListener);
        };
    });
    
    // Use a reactive effect to update the context when sharedHoveredPoint changes
    $effect(() => {
        if (chartHoverContext) {
            chartHoverContext.set(sharedHoveredPoint);
        }
    });
    
    // Update sharedHoveredPoint when chart reports a hover
    function handleChartHover(point: DataItem | null) {
        sharedHoveredPoint = point;
    }
</script>

<div class="tests-container">
	<div class="tests-header">
		<div class="tests-header__content">
			<h1 class="tests-header__title">Data Visualizations</h1>
			<p class="tests-header__description">Interactive charts and visualizations for survey data</p>
		</div>
		
		<div class="tests-header__actions">
			<DataSelector />
			<a href="/survey-viewer" class="button button--primary">{t('tools.surveyViewer', $language) || 'Survey Viewer'}</a>
		</div>
	</div>
		
	<!-- Display loading or error state -->
	{#if dataResource.loading}
		<div class="loading-state">Loading data file... Please wait.</div>
	{:else if dataResource.error}
		<div class="error-state">Error: {dataResource.error.message}</div>
	{/if}

	<!-- Vertical split for top and bottom sections -->
	<div class="main-split-container">
		{#if !dataResource.loading && !dataResource.error && dataResource.current.data.length > 0}
			<SplitPane type="vertical" min="30%" max="60%" pos="50%" --color="#ddd" --thickness="4px">
				{#snippet a()}
					<!-- Top section with horizontal split for pane 1 and pane 2 -->
					<SplitPane 
						type="horizontal" 
						min="30%" 
						max="70%" 
						pos="50%" 
						--color="#ddd" 
						--thickness="4px"
						--handle-position="relative"
					>
						{#snippet a()}
							<!-- Pane 1: Methane Only Chart -->
							<div class="chart-panel">
								<div class="chart-card">
									<h2>{t('tests.chart.methaneOnly', $language)}</h2>
									<div class="chart-wrapper">
										<LineChart 
											dataSource={dataResource.current.data}
											yColumn="CH4"
											xAxisLabel={t('tests.chart.timeLabel', $language)}
											yAxisLabel="ppm"
											title={t('tests.chart.methaneTitle', $language)}
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
							<!-- Pane 2: GPS Scatter Plot and Wind Rose -->
							<div class="chart-panel">
								<div class="chart-card">
									<h2>{t('tests.chart.gpsTraceTitle', $language)}</h2>
									<div class="chart-wrapper">
										<!-- Scatter Chart with integrated Wind Rose -->
										<ScatterChart 
											dataSource={dataResource.current.data}
											xColumn="GPS_ABS_LONG"
											yColumn="GPS_ABS_LAT"
											xAxisLabel={t('tests.chart.longitudeLabel', $language)} 
											yAxisLabel={t('tests.chart.latitudeLabel', $language)}
											title={t('tests.chart.gpsTitle', $language)}
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
													title={t('tests.chart.windRoseTitle', $language) || 'Wind Distribution'}
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
					<!-- Bottom section with horizontal split for pane 3 and pane 4 -->
					<SplitPane 
						type="horizontal" 
						min="30%" 
						max="70%" 
						pos="50%" 
						--color="#ddd" 
						--thickness="4px"
						--handle-position="relative"
					>
						{#snippet a()}
							<!-- Pane 3: Dual-Axis CH4/C2H6 Chart -->
							<div class="chart-panel">
								<div class="chart-card">
									<h2>{t('tests.chart.timeSeriesTitle', $language)}</h2>
									<div class="chart-wrapper">
										<DualAxisChart 
											dataSource={dataResource.current.data}
											xColumn="EPOCH_TIME"
											leftYColumn="CH4"
											rightYColumn="C2H6"
											leftYLabel={t('tests.chart.ch4Label', $language)}
											rightYLabel={t('tests.chart.c2h6Label', $language)}
											leftColor="#38bdf8"
											rightColor="#f97316"
											title={t('tests.chart.dualAxisTitle', $language)}
											xAxisLabel={t('tests.chart.timeLabel', $language)}
											tooltipTimeLabel={t('tests.chart.tooltipTimeLabel', $language)}
											tooltipUnitMultiplier={1000}
										/>
									</div>
								</div>
							</div>
						{/snippet}
						
						{#snippet b()}
							<!-- Pane 4: Information Panel -->
							<div class="info-panel">
								<div class="info-card">
									<div class="info-content">
										<!-- Summary card with key stats -->
										<div class="summary-card">
											<div class="summary-header">
												<h3>{selectedFile.name}</h3>
												<div class="timestamp">
													<span class="timestamp-icon">⏱️</span> 
													{new Date(dataResource.current.data[0]?.EPOCH_TIME * 1000).toLocaleString()} 
													<span class="timestamp-separator">→</span> 
													{new Date(dataResource.current.data[dataResource.current.data.length-1]?.EPOCH_TIME * 1000).toLocaleString()}
												</div>
											</div>
											<div class="key-stats">
												<div class="key-stat-item">
													<div class="key-stat-value">{minCH4.toFixed(2)}<span class="key-stat-unit">ppm</span></div>
													<div class="key-stat-label">{t('tests.infoPanel.summary.minCH4', $language)}</div>
												</div>
												<div class="key-stat-item">
													<div class="key-stat-value">{averageCH4.toFixed(2)}<span class="key-stat-unit">ppm</span></div>
													<div class="key-stat-label">{t('tests.infoPanel.summary.avgCH4', $language)}</div>
												</div>
												<div class="key-stat-item">
													<div class="key-stat-value">{maxCH4.toFixed(2)}<span class="key-stat-unit">ppm</span></div>
													<div class="key-stat-label">{t('tests.infoPanel.summary.maxCH4', $language)}</div>
												</div>
												<div class="key-stat-item">
													<div class="key-stat-value">{dataResource.current.data.length}</div>
													<div class="key-stat-label">{t('tests.infoPanel.summary.dataPoints', $language)}</div>
												</div>
												<div class="key-stat-item">
													<div class="key-stat-value">{(averageSpeed * 3.6).toFixed(1)}<span class="key-stat-unit">km/h</span></div>
													<div class="key-stat-label">{t('tests.infoPanel.summary.avgCarSpeed', $language)}</div>
												</div>
												<div class="key-stat-item">
													<div class="key-stat-value">{calculateAverageWind().toFixed(1)}<span class="key-stat-unit">m/s</span></div>
													<div class="key-stat-label">{t('tests.infoPanel.summary.avgWind', $language)}</div>
												</div>
											</div>
										</div>
										
										<!-- Detailed stats table -->
										<div class="info-section">
											<h3 class="section-title">{t('tests.infoPanel.detailedStats.title', $language)}</h3>
											<div class="stats-table">
												<table>
													<thead>
														<tr>
															<th>{t('tests.infoPanel.detailedStats.parameter', $language)}</th>
															<th>{t('tests.infoPanel.detailedStats.min', $language)}</th>
															<th>{t('tests.infoPanel.detailedStats.max', $language)}</th>
															<th>{t('tests.infoPanel.detailedStats.average', $language)}</th>
														</tr>
													</thead>
													<tbody>
														<tr>
															<td><strong>CH₄</strong></td>
															<td>{minCH4.toFixed(3)} ppm</td>
															<td>{maxCH4.toFixed(3)} ppm</td>
															<td>{averageCH4.toFixed(3)} ppm</td>
														</tr>
														<tr>
															<td><strong>C₂H₆</strong></td>
															<td>{(minC2H6 * 1000).toFixed(2)} ppb</td>
															<td>{(maxC2H6 * 1000).toFixed(2)} ppb</td>
															<td>{(averageC2H6 * 1000).toFixed(2)} ppb</td>
														</tr>
														<tr>
															<td><strong>{t('tests.infoPanel.stats.carSpeed', $language)}</strong></td>
															<td>{(minSpeed * 3.6).toFixed(1)} km/h</td>
															<td>{(maxSpeed * 3.6).toFixed(1)} km/h</td>
															<td>{(averageSpeed * 3.6).toFixed(1)} km/h</td>
														</tr>
														<tr>
															<td><strong>{t('tests.infoPanel.stats.windSpeed', $language)}</strong></td>
															<td>{calculateMinWind().toFixed(2)} m/s</td>
															<td>{calculateMaxWind().toFixed(2)} m/s</td>
															<td>{calculateAverageWind().toFixed(2)} m/s</td>
														</tr>
													</tbody>
												</table>
											</div>
										</div>
										
										<!-- Info notes -->
										<div class="info-section">
											<h3 class="section-title">{t('tests.infoPanel.notes.title', $language)}</h3>
											<div class="info-notes">
												<div class="info-note">
													<div class="info-note-header">
														<span class="info-note-icon">ℹ️</span>
														<span class="info-note-title">{t('tests.infoPanel.notes.ethaneNegativeTitle', $language)}</span>
													</div>
													<p class="info-note-text">
														{t('tests.infoPanel.notes.ethaneNegativeText', $language)}
													</p>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						{/snippet}
					</SplitPane>
				{/snippet}
			</SplitPane>
		{/if}
	</div>
</div>

<style>
	/* Apply global fixes to root elements */
	:global(body), :global(html) {
		overflow: hidden;
		height: 100%;
		margin: 0;
		padding: 0;
	}
	
	:global(.app) {
		height: 100%;
		overflow: hidden;
	}
	
	.tests-container {
		padding: 1rem;
		height: 100%;
		display: flex;
		flex-direction: column;
		background-color: var(--bg-primary);
		overflow: hidden; 
		color: var(--text-primary);
	}

	/* Component-specific header styles to avoid global conflicts */
	.tests-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 1rem;
	}
	
	.tests-header__content {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		text-align: left;
	}
	
	.tests-header__title {
		margin: 0 0 0.5rem 0;
		font-size: 1.8rem;
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.tests-header__description {
		margin: 0;
		color: var(--text-secondary);
		max-width: 36rem;
	}
	
	.tests-header__actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	/* Button styles using global variables */
	:global(.tests-header__actions .button) {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		font-weight: 500;
	}
	
	:global(.select-wrapper .button) {
		background-color: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
	}
	
	:global(.select-wrapper .button:hover) {
		background-color: var(--bg-tertiary);
		border-color: var(--border-hover);
	}

	/* Loading and error states */
	.loading-state, .error-state {
		padding: 1rem;
		margin-bottom: 1rem;
		border-radius: var(--radius-md);
		text-align: center;
	}
	
	.loading-state {
		background-color: rgba(59, 130, 246, 0.1);
		color: var(--info);
	}
	
	.error-state {
		background-color: rgba(239, 68, 68, 0.1);
		color: var(--error);
	}

	.main-split-container {
		flex: 1;
		min-height: 0; /* Important for flexbox to respect child height */
		position: relative;
		overflow: hidden; /* Ensure no scrollbars at split container level */
	}

	.chart-panel {
		height: 100%;
		width: 100%;
		padding: 0.35rem;
		overflow: hidden;
		box-sizing: border-box;
		display: flex;
	}

	.chart-card {
		background-color: #2a2a3c;  /* Dark card background */
		border-radius: 0.5rem;
		box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
		padding: 0.5rem 0.75rem;
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-sizing: border-box;
		border: 1px solid #3a3a4f;  /* Subtle border */
	}

	.chart-card h2 {
		margin: 0 0 0.25rem 0;
		font-size: 1.15rem;
		font-weight: 600;
		color: #e2e8f0;  /* Light text color */
		flex-shrink: 0;
		line-height: 1.2;
	}

	.chart-wrapper {
		flex: 1;
		min-height: 0; /* Important for flexbox to respect child height */
		position: relative;
		overflow: hidden; /* Added to prevent any scrollbars */
	}

	/* Wind Rose Overlay Styling */
	.wind-rose-overlay {
		position: absolute;
		top: 0px;  /* Keeps it high on the chart */
		right: 10px; /* Moved back to extreme right */
		width: 18%;
		height: 18%;
		min-width: 65px;
		min-height: 65px;
		max-width: 110px;
		max-height: 110px;
		background-color: rgba(42, 42, 60, 0.7);  /* Darker background to match theme */
		border-radius: 0.375rem;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);  /* Subtle shadow */
		z-index: 10;
		overflow: hidden;
		border: 1px solid rgba(58, 58, 79, 0.5);  /* Subtle border */
		transition: all 0.2s ease;
		opacity: 1;
	}
	
	.wind-rose-overlay:hover {
		opacity: 1;
		box-shadow: none;
		transform: scale(1.05);
	}
	
	.overlay-title {
		position: absolute;
		top: 2px;
		left: 4px;
		font-size: 0.65rem;
		font-weight: 600;
		color: #e2e8f0;  /* Light text color */
		z-index: 11;
		opacity: 1;
		padding: 1px 3px;
		background-color: rgba(42, 42, 60, 0.85);  /* Dark background */
		border-radius: 2px;
	}
	
	/* Global fixes for the SplitPane */
	:global(.splitpane-container) {
		overflow: hidden !important;
	}
	
	:global(.pane), :global(.pane > *) {
		height: 100%;
		overflow: hidden !important;
		box-sizing: border-box;
	}
	
	:global(.pane) {
		display: flex;
	}
	
	:global(.pane > div) {
		height: 100%;
		overflow: hidden !important;
		box-sizing: border-box;
		flex: 1;
	}
	
	:global(.splitpane-wrapper) {
		overflow: hidden !important;
	}

	/* Ensure charts fill available vertical space */
	:global(.chart-wrapper > div),
	:global(.chart-wrapper > svg) {
		height: 100% !important;
	}
	
	/* Add some styles for responsive chart contents */
	:global(svg text) {
		font-size: calc(0.6rem + 0.3vmin);
		fill: #e2e8f0;  /* Light text color for chart text */
	}

	/* More specific chart text selectors to ensure all text is visible */
	:global(.chart-title),
	:global(.axis-title),
	:global(.axis-label),
	:global(.tick text),
	:global(.legend text),
	:global(.chart-label),
	:global(.x-axis text),
	:global(.y-axis text) {
		fill: #e2e8f0 !important;  /* Light text color for chart text */
		color: #e2e8f0 !important;  /* For any text that uses color instead of fill */
	}
	
	/* Ensure axis labels are clearly visible */
	:global(.y-axis-label),
	:global(.x-axis-label) {
		fill: #e2e8f0 !important;
		font-weight: 500;
	}
	
	/* Make chart arrows and decorative elements visible */
	:global(.axis-arrow) {
		fill: #94a3b8 !important;  /* Lighter gray for arrows */
		font-weight: bold;
	}
	
	:global(.data-point:hover) {
		r: 6 !important;
	}

	/* Ensure axes are properly rendered without gaps */
	:global(.x-axis), :global(.y-axis) {
		shape-rendering: crispEdges; 
	}

	:global(.x-axis path), :global(.y-axis path) {
		stroke: #6b7280;  /* Darker gray for axes */
		stroke-width: 1px;
	}

	:global(.x-axis line), :global(.y-axis line) {
		stroke: #6b7280;  /* Darker gray for axes */
		stroke-width: 1px;
	}
	
	/* Apply consistent axis styles with correct positioning */
	:global(.x-axis .tick line) {
		stroke: #4b5563;  /* Even darker for tick lines */
	}
  
	:global(.y-axis .tick line) {
		stroke: #4b5563;  /* Even darker for tick lines */
	}

	/* Fix potential overflow issues */
	:global(svg) {
		overflow: visible;
	}
	
	/* Info panel styles - updated for better visual design */
	.info-panel {
		height: 100%;
		width: 100%;
		padding: 0.5rem;
		overflow: auto; 
		box-sizing: border-box;
	}
	
	.info-card {
		background-color: #2a2a3c;  /* Dark card background */
		border-radius: 0.5rem;
		box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
		padding: 0.75rem;
		height: 100%;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		border: 1px solid #3a3a4f;  /* Subtle border */
	}
	
	.info-content {
		flex: 1;
		overflow: auto;
	}
	
	/* Summary card styling */
	.summary-card {
		background-color: #313147;  /* Darker blue-gray background */
		border-radius: 0.5rem;
		padding: 0.75rem;
		margin-bottom: 1rem;
		border-left: 4px solid #38bdf8;  /* Brighter blue accent */
	}
	
	.summary-header {
		margin-bottom: 0.75rem;
	}
	
	.summary-header h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		color: #c9d1d9;  /* Light text */
	}
	
	.timestamp {
		font-size: 0.8rem;
		color: #9ca3af;  /* Muted gray text */
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	
	.timestamp-icon {
		font-size: 0.85rem;
	}
	
	.timestamp-separator {
		margin: 0 0.25rem;
		color: #94a3b8;
	}
	
	.key-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: space-between;
	}
	
	.key-stat-item {
		min-width: 80px;
		text-align: center;
	}
	
	.key-stat-value {
		font-size: 1.4rem;
		font-weight: 700;
		color: #5ebbf6;  /* Brighter blue */
		line-height: 1.2;
	}
	
	.key-stat-unit {
		font-size: 0.75rem;
		font-weight: 500;
		margin-left: 0.15rem;
		color: #7dd3fc;  /* Light blue */
	}
	
	.key-stat-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: #9ca3af;  /* Muted gray text */
		margin-top: 0.15rem;
	}
	
	/* Section styling */
	.info-section {
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
	}
	
	.section-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: #d1d5db;  /* Light gray text */
		margin: 0 0 0.5rem 0;
		padding-bottom: 0.3rem;
		border-bottom: 1px solid #3a3a4f;  /* Darker border */
	}
	
	/* Stats table styling */
	.stats-table {
		overflow-x: auto;
	}
	
	.stats-table table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	
	.stats-table th {
		text-align: left;
		padding: 0.4rem 0.5rem;
		background-color: #343453;  /* Darker header */
		color: #c9d1d9;  /* Light text */
		font-weight: 500;
		border-bottom: 1px solid #3a3a4f;
	}
	
	.stats-table td {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid #2e2e40;  /* Dark border */
		color: #e2e8f0;  /* Light text */
	}
	
	.stats-table tr:last-child td {
		border-bottom: none;
	}
	
	/* Legend styling */
	.legend-content {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	
	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
	
	.legend-icon {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		display: inline-block;
	}
	
	.legend-text {
		color: #475569;
	}

	.wind-rose-container {
		width: 100%;
		height: 100%;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	/* Info notes styling */
	.info-notes {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.info-note {
		background-color: #343453;  /* Dark note background */
		border-radius: 0.375rem;
		padding: 0.6rem;
		border-left: 3px solid #6b7280;  /* Darker gray accent */
	}
	
	.info-note-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
	}
	
	.info-note-icon {
		font-size: 0.9rem;
	}
	
	.info-note-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: #d1d5db;  /* Light text */
	}
	
	.info-note-text {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.4;
		color: #9ca3af;  /* Muted gray text */
	}

	/* Add styles for the new header structure */
	.header-content {
		margin-bottom: 1rem;
	}
	
	.header-content h1 {
		margin: 0 0 0.5rem 0;
		font-size: 1.8rem;
		font-weight: 600;
		color: #e2e8f0;
	}
	
	.header-content .description {
		margin: 0;
		color: #9ca3af;
	}
	
	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	
	.survey-btn {
		padding: 0.4rem 0.8rem;
		font-size: 0.85rem;
		white-space: nowrap;
		min-width: auto;
	}
	
	.nav-link {
		display: inline-block;
		padding: 0.4rem 0.8rem;
		background-color: #2563eb;
		color: white;
		text-decoration: none;
		border-radius: 0.375rem;
		font-size: 0.85rem;
		transition: background-color 0.2s;
		white-space: nowrap;
	}
	
	.nav-link:hover {
		background-color: #1d4ed8;
	}
</style> 