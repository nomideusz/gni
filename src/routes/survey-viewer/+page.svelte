<script lang="ts">
	import { t, language, SplitPane } from '$lib';
	import { resource, Context } from 'runed';
	import { onMount } from 'svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import ScatterChart from '$lib/components/ScatterChart.svelte';
	import DualAxisChart from '$lib/components/DualAxisChart.svelte';
	import WindRoseChart from '$lib/components/WindRoseChart.svelte';
	
	// Define data structure for DAT files
	interface DataItem {
		EPOCH_TIME: number;
		[key: string]: number | string;
	}
	
	// File upload variables
	let fileInput: HTMLInputElement;
	let uploadedFileName = $state('');
	let isUploaded = $state(false);
	let uploadError = $state('');
	let uploadedData = $state<{ data: DataItem[], columns: string[] } | null>(null);
	
	// Create a Context for hover interactions shared across all chart components
	const chartHoverContext = new Context<DataItem | null>('chartHoverPoint');
	
	// State for tracking hovered point with Context
	let sharedHoveredPoint = $state<DataItem | null>(null);
	
	// Flag to show/hide visualizations
	let showVisualizations = $state(false);
	
	// Use resource for reactive data fetching
	const dataResource = resource(
		() => ({ isUploaded, uploadedData }),
		async (source, prevSource, { signal }) => {
			// Handle local file upload
			if (source.isUploaded && source.uploadedData) {
				console.log('Using uploaded data');
				return source.uploadedData;
			}
			
			// If no data is uploaded yet, return empty structure
			return { data: [], columns: [] };
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
	
	// Handle file upload
	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		uploadError = '';
		
		if (!input.files || input.files.length === 0) {
			return;
		}
		
		const file = input.files[0];
		
		// Check file extension
		if (!file.name.toLowerCase().endsWith('.dat')) {
			uploadError = 'Invalid file format. Please upload a .dat file.';
			return;
		}
		
		try {
			// Read the file
			const text = await file.text();
			uploadedData = parseDataText(text);
			uploadedFileName = file.name;
			isUploaded = true;
			
			console.log(`Uploaded ${file.name} with ${uploadedData.data.length} data points`);
		} catch (error) {
			console.error('Error processing uploaded file:', error);
			uploadError = `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`;
			isUploaded = false;
			uploadedData = null;
		}
	}
	
	// Calculate statistics for display in the info panel
	let selectedFile = $derived(isUploaded ? { name: uploadedFileName } : null);
	
	// CH4 statistics
	let minCH4 = $derived(dataResource.current.data.length > 0 ? 
		Math.min(...dataResource.current.data.map(d => d.CH4 as number)) : 0);
	let maxCH4 = $derived(dataResource.current.data.length > 0 ? 
		Math.max(...dataResource.current.data.map(d => d.CH4 as number)) : 0);
	let averageCH4 = $derived(dataResource.current.data.length > 0 ?
		dataResource.current.data.reduce((sum, d) => sum + (d.CH4 as number), 0) / 
		dataResource.current.data.length : 0);
	
	// C2H6 statistics
	let minC2H6 = $derived(dataResource.current.data.length > 0 ?
		Math.min(...dataResource.current.data.map(d => d.C2H6 as number)) : 0);
	let maxC2H6 = $derived(dataResource.current.data.length > 0 ?
		Math.max(...dataResource.current.data.map(d => d.C2H6 as number)) : 0);
	let averageC2H6 = $derived(dataResource.current.data.length > 0 ?
		dataResource.current.data.reduce((sum, d) => sum + (d.C2H6 as number), 0) / 
		dataResource.current.data.length : 0);
	
	// Speed statistics
	let maxSpeed = $derived(dataResource.current.data.length > 0 ? 
		Math.max(...dataResource.current.data.map(d => d.CAR_SPEED as number)) : 0);
	let averageSpeed = $derived(dataResource.current.data.length > 0 ?
		dataResource.current.data.reduce((sum, d) => sum + (d.CAR_SPEED as number), 0) / 
		dataResource.current.data.length : 0);
	let minSpeed = $derived(dataResource.current.data.length > 0 ? 
		Math.min(...dataResource.current.data.map(d => d.CAR_SPEED as number)) : 0);
	
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
	
	// Toggle visualizations
	function toggleVisualizations() {
		showVisualizations = !showVisualizations;
	}
	
	// Update sharedHoveredPoint when chart reports a hover
	function handleChartHover(point: DataItem | null) {
		sharedHoveredPoint = point;
	}
	
	// Initialize the context during component initialization
	onMount(() => {
		// Initialize the hover context
		chartHoverContext.set(null);
		
		return () => {
			// Cleanup
		};
	});
	
	// Use a reactive effect to update the context when sharedHoveredPoint changes
	$effect(() => {
		if (chartHoverContext) {
			chartHoverContext.set(sharedHoveredPoint);
		}
	});
</script>

<div class="survey-viewer-container">
	<div class="page-header">
		<h1>Survey Viewer</h1>
		<p class="description">View and analyze survey data files</p>
		
		<!-- File Upload Section -->
		<div class="upload-section">
			<div class="upload-container">
				<label for="dat-file-upload" class="upload-label">
					<span>Upload .DAT File</span>
				</label>
				<input 
					type="file" 
					id="dat-file-upload" 
					accept=".dat"
					bind:this={fileInput}
					on:change={handleFileUpload}
					class="file-input"
				/>
			</div>
			
			{#if isUploaded}
				<div class="upload-info">
					<span class="uploaded-file-name">{uploadedFileName}</span>
				</div>
			{/if}
			
			{#if uploadError}
				<div class="upload-error">
					{uploadError}
				</div>
			{/if}
		</div>
		
		<!-- Display loading or error state -->
		{#if dataResource.loading}
			<div class="loading-state">Loading data file... Please wait.</div>
		{:else if dataResource.error}
			<div class="error-state">Error: {dataResource.error.message}</div>
		{/if}
	</div>

	<div class="main-content">
		{#if !dataResource.loading && !dataResource.error && dataResource.current.data.length > 0}
			<div class="data-summary-card">
				<div class="summary-header">
					<h3>{selectedFile?.name}</h3>
					{#if dataResource.current.data.length > 0}
						<div class="timestamp">
							<span class="timestamp-icon">⏱️</span> 
							{new Date(dataResource.current.data[0]?.EPOCH_TIME * 1000).toLocaleString()} 
							<span class="timestamp-separator">→</span> 
							{new Date(dataResource.current.data[dataResource.current.data.length-1]?.EPOCH_TIME * 1000).toLocaleString()}
						</div>
					{/if}
				</div>
				
				<div class="data-stats">
					<div class="stat-section">
						<h4>File Information</h4>
						<div class="stat-grid">
							<div class="stat-item">
								<div class="stat-label">Data Points</div>
								<div class="stat-value">{dataResource.current.data.length.toLocaleString()}</div>
							</div>
							<div class="stat-item">
								<div class="stat-label">Columns</div>
								<div class="stat-value">{dataResource.current.columns.length}</div>
							</div>
							<div class="stat-item">
								<div class="stat-label">Duration</div>
								<div class="stat-value">
									{dataResource.current.data.length > 0 ? 
										((dataResource.current.data[dataResource.current.data.length-1].EPOCH_TIME - 
										dataResource.current.data[0].EPOCH_TIME) / 60).toFixed(2) + ' min' : 
										'N/A'}
								</div>
							</div>
						</div>
					</div>
					
					<div class="stat-section">
						<h4>CH₄ Statistics</h4>
						<div class="stat-grid">
							<div class="stat-item">
								<div class="stat-label">Minimum</div>
								<div class="stat-value">{minCH4.toFixed(2)} ppm</div>
							</div>
							<div class="stat-item">
								<div class="stat-label">Average</div>
								<div class="stat-value">{averageCH4.toFixed(2)} ppm</div>
							</div>
							<div class="stat-item">
								<div class="stat-label">Maximum</div>
								<div class="stat-value">{maxCH4.toFixed(2)} ppm</div>
							</div>
						</div>
					</div>
					
					<div class="stat-section">
						<h4>C₂H₆ Statistics</h4>
						<div class="stat-grid">
							<div class="stat-item">
								<div class="stat-label">Minimum</div>
								<div class="stat-value">{minC2H6.toFixed(3)} ppm</div>
							</div>
							<div class="stat-item">
								<div class="stat-label">Average</div>
								<div class="stat-value">{averageC2H6.toFixed(3)} ppm</div>
							</div>
							<div class="stat-item">
								<div class="stat-label">Maximum</div>
								<div class="stat-value">{maxC2H6.toFixed(3)} ppm</div>
							</div>
						</div>
					</div>
				</div>
				
				<div class="column-list">
					<h4>Available Data Columns</h4>
					<div class="columns-grid">
						{#each dataResource.current.columns as column}
							<div class="column-item">{column}</div>
						{/each}
					</div>
				</div>
				
				<div class="actions">
					<button class="action-button primary" on:click={toggleVisualizations}>
						{showVisualizations ? 'Hide Visualizations' : 'Show Visualizations'}
					</button>
					<button class="action-button" on:click={() => alert('Data export not implemented')}>
						Export Data
					</button>
				</div>
			</div>
			
			<!-- Visualizations Section -->
			{#if showVisualizations}
				<div class="visualizations-container">
					<h2>Data Visualizations</h2>
					
					<div class="charts-grid">
						<SplitPane type="vertical" min="30%" max="70%" pos="50%" --color="#2d2d42" --thickness="4px">
							{#snippet a()}
								<!-- Top charts -->
								<SplitPane 
									type="horizontal" 
									min="30%" 
									max="70%" 
									pos="50%" 
									--color="#2d2d42" 
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
				</div>
			{/if}
		{:else if !dataResource.loading && !dataResource.error}
			<div class="empty-state">
				<div class="empty-icon">📊</div>
				<h3>No Data to Display</h3>
				<p>Upload a .DAT file to view survey data</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.survey-viewer-container {
		height: 100%;
		display: flex;
		flex-direction: column;
		background-color: #1e1e2e;
		color: #e2e8f0;
		overflow: hidden;
	}

	.page-header {
		padding: 1.5rem;
		border-bottom: 1px solid #2d2d42;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 1.8rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.description {
		margin: 0 0 1.5rem 0;
		color: #9ca3af;
	}
	
	.upload-section {
		margin-bottom: 1rem;
	}

	.upload-container {
		display: flex;
		align-items: center;
	}

	.upload-label {
		display: inline-block;
		padding: 0.5rem 1rem;
		background-color: #2563eb;
		color: white;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.upload-label:hover {
		background-color: #1d4ed8;
	}

	.file-input {
		display: none;
	}

	.upload-info {
		display: flex;
		align-items: center;
		margin-top: 0.5rem;
		gap: 1rem;
	}

	.uploaded-file-name {
		font-size: 0.875rem;
		color: #9ca3af;
		font-style: italic;
	}

	.upload-error {
		margin-top: 0.5rem;
		padding: 0.5rem;
		background-color: rgba(239, 68, 68, 0.2);
		border-left: 3px solid #ef4444;
		color: #fca5a5;
		font-size: 0.875rem;
	}

	.loading-state {
		margin-top: 1rem;
		padding: 1rem;
		background-color: rgba(96, 165, 250, 0.1);
		border-radius: 0.375rem;
		text-align: center;
		color: #93c5fd;
	}

	.error-state {
		margin-top: 1rem;
		padding: 1rem;
		background-color: rgba(239, 68, 68, 0.1);
		border-radius: 0.375rem;
		text-align: center;
		color: #fca5a5;
	}

	.main-content {
		flex: 1;
		padding: 1.5rem;
		overflow: auto;
	}

	.data-summary-card {
		background-color: #252538;
		border-radius: 0.5rem;
		padding: 1.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.summary-header {
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #424254;
	}

	.summary-header h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		font-weight: 500;
	}

	.timestamp {
		font-size: 0.875rem;
		color: #9ca3af;
	}

	.timestamp-separator {
		margin: 0 0.5rem;
		color: #6b7280;
	}

	.data-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.stat-section h4 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #94a3b8;
		font-weight: 500;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.stat-item {
		padding: 0.75rem;
		background-color: #1e1e2e;
		border-radius: 0.375rem;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #9ca3af;
		margin-bottom: 0.25rem;
	}

	.stat-value {
		font-size: 1rem;
		font-weight: 500;
	}

	.column-list {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #424254;
	}

	.column-list h4 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #94a3b8;
		font-weight: 500;
	}

	.columns-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.5rem;
	}

	.column-item {
		padding: 0.5rem;
		background-color: #1e1e2e;
		border-radius: 0.25rem;
		font-size: 0.875rem;
		text-align: center;
		border: 1px solid #424254;
	}

	.actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #424254;
	}

	.action-link, .action-button {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		text-align: center;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.action-button {
		background-color: #4b5563;
		color: white;
		border: none;
	}

	.action-button:hover {
		background-color: #374151;
	}
	
	.action-button.primary {
		background-color: #2563eb;
		color: white;
	}
	
	.action-button.primary:hover {
		background-color: #1d4ed8;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		background-color: #252538;
		border-radius: 0.5rem;
		text-align: center;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
	}

	.empty-state p {
		color: #9ca3af;
		max-width: 400px;
	}
	
	/* Visualization styles */
	.visualizations-container {
		margin-top: 2rem;
		background-color: #252538;
		border-radius: 0.5rem;
		padding: 1.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}
	
	.visualizations-container h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #e2e8f0;
	}
	
	.charts-grid {
		height: 70vh;
		min-height: 500px;
		margin-bottom: 1rem;
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
		background-color: #2a2a3c;
		border-radius: 0.5rem;
		box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
		padding: 0.5rem 0.75rem;
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-sizing: border-box;
		border: 1px solid #3a3a4f;
	}
	
	.chart-card h3 {
		margin: 0 0 0.25rem 0;
		font-size: 1.15rem;
		font-weight: 600;
		color: #e2e8f0;
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
		right: 10px;
		width: 18%;
		height: 18%;
		min-width: 65px;
		min-height: 65px;
		max-width: 110px;
		max-height: 110px;
		background-color: rgba(42, 42, 60, 0.7);
		border-radius: 0.375rem;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
		z-index: 10;
		overflow: hidden;
		border: 1px solid rgba(58, 58, 79, 0.5);
		transition: all 0.2s ease;
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
	
	/* Global SplitPane styles */
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
	
	/* Chart text styles */
	:global(svg text) {
		font-size: calc(0.6rem + 0.3vmin);
		fill: #e2e8f0;
	}
	
	:global(.chart-title),
	:global(.axis-title),
	:global(.axis-label),
	:global(.tick text),
	:global(.legend text),
	:global(.chart-label),
	:global(.x-axis text),
	:global(.y-axis text) {
		fill: #e2e8f0 !important;
		color: #e2e8f0 !important;
	}
	
	:global(.y-axis-label),
	:global(.x-axis-label) {
		fill: #e2e8f0 !important;
		font-weight: 500;
	}
	
	:global(.axis-arrow) {
		fill: #94a3b8 !important;
		font-weight: bold;
	}
	
	:global(.data-point:hover) {
		r: 6 !important;
	}
	
	:global(.x-axis), :global(.y-axis) {
		shape-rendering: crispEdges; 
	}
	
	:global(.x-axis path), :global(.y-axis path) {
		stroke: #6b7280;
		stroke-width: 1px;
	}
	
	:global(.x-axis line), :global(.y-axis line) {
		stroke: #6b7280;
		stroke-width: 1px;
	}
	
	:global(.x-axis .tick line) {
		stroke: #4b5563;
	}
  
	:global(.y-axis .tick line) {
		stroke: #4b5563;
	}
	
	:global(svg) {
		overflow: visible;
	}
</style> 