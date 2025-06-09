<script lang="ts">
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';
	import { SplitPane } from '$lib';
	import { resource } from 'runed';
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
	let isDragOver = $state(false);
	
	// State for tracking hovered point across charts
	let sharedHoveredPoint = $state<DataItem | null>(null);
	
	// Flag to show/hide visualizations
	let showVisualizations = $state(true);
	
	// State for saving and sharing files
	let isSaving = $state(false);
	let shareUrl = $state('');
	let saveError = $state('');
	
	// Use resource for reactive data fetching
	const dataResource = resource(
		() => ({ isUploaded, uploadedData }),
		async (source, prevSource, { signal }) => {
			// Handle local file upload
			if (source.isUploaded && source.uploadedData) {
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
	
	// Handle file processing
	async function processFile(file: File) {
		uploadError = '';
		
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
		} catch (error) {
			console.error('Error processing uploaded file:', error);
			uploadError = `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`;
			isUploaded = false;
			uploadedData = null;
		}
	}

	// Handle file upload from input
	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		
		if (!input.files || input.files.length === 0) {
			return;
		}
		
		const file = input.files[0];
		await processFile(file);
	}

	// Handle drag and drop
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragOver = false;
		
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			processFile(files[0]);
		}
	}

	// Trigger file input click
	function triggerFileInput() {
		fileInput?.click();
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
	
	// Save and share file
	async function saveAndShareFile() {
		if (!uploadedData || !uploadedFileName) {
			saveError = 'No file to save';
			return;
		}
		
		isSaving = true;
		saveError = '';
		shareUrl = '';
		
		try {
			const response = await fetch('/api/v1/shared-files', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					filename: uploadedFileName,
					data: uploadedData.data,
					columns: uploadedData.columns,
					uploadedAt: new Date().toISOString()
				})
			});
			
			if (!response.ok) {
				throw new Error('Failed to save file');
			}
			
			const result = await response.json();
			shareUrl = `${window.location.origin}/shared/${result.shareId}`;
			
			// Copy to clipboard
			await navigator.clipboard.writeText(shareUrl);
			
			// Show success notification with deduplication info
			if (result.isDuplicate) {
				alert('This file was already shared! Existing share link copied to clipboard.');
			} else {
				alert('File saved and share link copied to clipboard!');
			}
			
		} catch (error) {
			console.error('Error saving file:', error);
			saveError = error instanceof Error ? error.message : 'Failed to save file';
		} finally {
			isSaving = false;
		}
	}
	
	// Update sharedHoveredPoint when chart reports a hover
	function handleChartHover(point: DataItem | null) {
		sharedHoveredPoint = point;
	}
	
	// No need for Context initialization - using direct prop passing
</script>

<PageTemplate 
	title="Survey Viewer" 
	description="View and analyze survey data files"
	fullWidth={true}
>
	{#snippet pageActions()}
		{#if !dataResource.loading && !dataResource.error && dataResource.current.data.length > 0}
			<div class="action-group">
				<button 
					class="button button--secondary" 
					onclick={saveAndShareFile}
					disabled={isSaving || !uploadedData}
				>
					{isSaving ? 'Saving...' : 'Save & Share'}
				</button>
				{#if shareUrl}
					<button class="button button--secondary" onclick={() => navigator.clipboard.writeText(shareUrl)}>
						Copy Link
					</button>
				{/if}
			</div>
			<button class="button button--primary" onclick={toggleVisualizations}>
				{showVisualizations ? 'Hide Charts' : 'Show Charts'}
			</button>
		{/if}
	{/snippet}

	{#snippet content()}
		<SectionContainer title="File Upload" showActions={false} width="full">
			{#snippet children()}
				<div class="upload-section">
					{#if !isUploaded}
						<div 
							class="upload-dropzone"
							class:drag-over={isDragOver}
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							ondrop={handleDrop}
							onclick={triggerFileInput}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? triggerFileInput() : null}
						>
							<div class="upload-icon">
								<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
									<polyline points="7,10 12,15 17,10"/>
									<line x1="12" y1="15" x2="12" y2="3"/>
								</svg>
							</div>
							<div class="upload-text">
								<h3>Drop your .DAT file here</h3>
								<p>or <span class="upload-link">click to browse</span></p>
								<small>Supports .dat files only</small>
							</div>
						</div>
						
						<input 
							type="file" 
							id="dat-file-upload" 
							accept=".dat"
							bind:this={fileInput}
							onchange={handleFileUpload}
							class="file-input"
						/>
					{:else}
						<div class="upload-success">
							<div class="upload-success-icon">
								<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
									<polyline points="22,4 12,14.01 9,11.01"/>
								</svg>
							</div>
							<div class="upload-success-content">
								<h4>File uploaded successfully</h4>
								<p class="uploaded-file-name">{uploadedFileName}</p>
								<button class="button button--discrete button--small" onclick={() => { isUploaded = false; uploadedData = null; uploadedFileName = ''; }}>
									Upload different file
								</button>
							</div>
						</div>
					{/if}
					
					{#if uploadError}
						<div class="upload-error">
							<div class="upload-error-icon">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<line x1="15" y1="9" x2="9" y2="15"/>
									<line x1="9" y1="9" x2="15" y2="15"/>
								</svg>
							</div>
							<div class="upload-error-content">
								<strong>Upload failed</strong>
								<p>{uploadError}</p>
							</div>
						</div>
					{/if}
					
					<!-- Display loading or error state -->
					{#if dataResource.loading}
						<div class="loading-state">
							<div class="loading-spinner"></div>
							<p>Loading data file... Please wait.</p>
						</div>
					{:else if dataResource.error}
						<div class="error-state">
							<div class="error-icon">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"/>
									<line x1="15" y1="9" x2="9" y2="15"/>
									<line x1="9" y1="9" x2="15" y2="15"/>
								</svg>
							</div>
							<p>Error: {dataResource.error.message}</p>
						</div>
					{/if}
				</div>
			{/snippet}
		</SectionContainer>

		{#if !dataResource.loading && !dataResource.error && dataResource.current.data.length > 0}
			<!-- Combined File Information and Statistics -->
			<SectionContainer title="File Overview" showActions={false} width="full">
				{#snippet children()}
					<div class="file-overview">
						<!-- File Info Column -->
						<div class="file-info-compact">
							<h3 class="file-name-compact">{selectedFile?.name}</h3>
							{#if dataResource.current.data.length > 0}
								<div class="timestamp-compact">
									<span class="timestamp-icon">⏱️</span> 
									{new Date(dataResource.current.data[0]?.EPOCH_TIME * 1000).toLocaleString()} 
									<span class="timestamp-separator">→</span> 
									{new Date(dataResource.current.data[dataResource.current.data.length-1]?.EPOCH_TIME * 1000).toLocaleString()}
								</div>
							{/if}
						</div>
						
						<!-- Statistics Grid -->
						<div class="stats-compact">
							<div class="stat-item">
								<span class="stat-label">Data Points</span>
								<span class="stat-value">{dataResource.current.data.length.toLocaleString()}</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Duration</span>
								<span class="stat-value">
									{dataResource.current.data.length > 0 ? 
										((dataResource.current.data[dataResource.current.data.length-1].EPOCH_TIME - 
										dataResource.current.data[0].EPOCH_TIME) / 60).toFixed(1) + ' min' : 
										'N/A'}
								</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">CH₄ Range</span>
								<span class="stat-value">{minCH4.toFixed(2)} - {maxCH4.toFixed(2)} ppm</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">CH₄ Avg</span>
								<span class="stat-value">{averageCH4.toFixed(2)} ppm</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">C₂H₆ Range</span>
								<span class="stat-value">{minC2H6.toFixed(3)} - {maxC2H6.toFixed(3)} ppm</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">C₂H₆ Avg</span>
								<span class="stat-value">{averageC2H6.toFixed(3)} ppm</span>
							</div>
						</div>
						
						<!-- Available Columns -->
						<div class="columns-compact">
							<span class="columns-label">Columns:</span>
							<div class="columns-tags">
								{#each dataResource.current.columns as column}
									<span class="column-tag">{column}</span>
								{/each}
							</div>
						</div>
					</div>
				{/snippet}
			</SectionContainer>

			{#if saveError}
				<SectionContainer title="Error" showActions={false} width="full">
					{#snippet children()}
						<div class="save-error">
							{saveError}
						</div>
					{/snippet}
				</SectionContainer>
			{/if}
			
			<!-- Visualizations Section -->
			{#if showVisualizations}
				<SectionContainer title="Data Visualizations" showActions={false} width="full">
					{#snippet children()}
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
					{/snippet}
				</SectionContainer>
			{/if}
		{:else if !dataResource.loading && !dataResource.error}
			<SectionContainer title="No Data" showActions={false} width="full">
				{#snippet children()}
					<div class="empty-state">
						<div class="empty-icon">📊</div>
						<h3>No Data to Display</h3>
						<p>Upload a .DAT file to view survey data</p>
					</div>
				{/snippet}
			</SectionContainer>
		{/if}
	{/snippet}
</PageTemplate>

<style>
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

	.upload-section {
		padding: var(--space-lg);
	}

	.upload-dropzone {
		border: 2px dashed var(--border-primary);
		border-radius: var(--radius-lg);
		padding: 3rem 2rem;
		text-align: center;
		cursor: pointer;
		transition: all var(--transition-normal) ease;
		background-color: var(--bg-secondary);
		position: relative;
		overflow: hidden;
	}

	.upload-dropzone:hover,
	.upload-dropzone:focus {
		border-color: var(--accent-primary);
		background-color: var(--bg-tertiary);
		outline: none;
	}

	.upload-dropzone.drag-over {
		border-color: var(--accent-primary);
		background-color: var(--bg-tertiary);
		transform: scale(1.02);
		box-shadow: var(--shadow-md);
	}

	.upload-icon {
		color: var(--accent-primary);
		margin-bottom: var(--space-md);
		opacity: 0.8;
	}

	.upload-text h3 {
		margin: 0 0 var(--space-sm) 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.upload-text p {
		margin: 0 0 var(--space-sm) 0;
		color: var(--text-secondary);
		font-size: 1rem;
	}

	.upload-link {
		color: var(--accent-primary);
		font-weight: 500;
		text-decoration: underline;
	}

	.upload-text small {
		color: var(--text-secondary);
		font-size: 0.875rem;
		opacity: 0.7;
	}

	.file-input {
		display: none;
	}

	.upload-success {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-lg);
		background-color: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.2);
		border-radius: var(--radius-lg);
	}

	.upload-success-icon {
		color: var(--success);
		flex-shrink: 0;
	}

	.upload-success-content {
		flex: 1;
	}

	.upload-success-content h4 {
		margin: 0 0 var(--space-xs) 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.uploaded-file-name {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0 0 var(--space-sm) 0;
		font-family: monospace;
	}

	.upload-error {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		margin-top: var(--space-md);
		padding: var(--space-md);
		background-color: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: var(--radius-md);
	}

	.upload-error-icon {
		color: var(--error);
		flex-shrink: 0;
		margin-top: var(--space-xs);
	}

	.upload-error-content strong {
		display: block;
		color: var(--error);
		font-weight: 600;
		margin-bottom: var(--space-xs);
	}

	.upload-error-content p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
		opacity: 0.8;
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

	.columns-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		padding: var(--space-lg);
	}

	.save-error {
		margin: var(--space-lg);
		padding: var(--space-sm);
		background-color: rgba(239, 68, 68, 0.1);
		border-left: 3px solid var(--error);
		color: var(--text-secondary);
		font-size: 0.875rem;
		border-radius: var(--radius-md);
		opacity: 0.8;
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
	
	/* File Overview Compact Layout */
	.file-overview {
		display: grid;
		grid-template-columns: 1fr 2fr 1fr;
		gap: var(--space-lg);
		padding: var(--space-md) var(--space-lg);
		align-items: start;
	}

	.file-info-compact {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.file-name-compact {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.timestamp-compact {
		font-size: 0.8rem;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.stats-compact {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-sm);
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-xs);
		background-color: var(--bg-tertiary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-primary);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat-value {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.1;
	}

	.columns-compact {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.columns-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.columns-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.column-tag {
		display: inline-block;
		font-size: 0.7rem;
		padding: 2px 6px;
		background-color: var(--accent-primary);
		color: white;
		border-radius: var(--radius-sm);
		font-weight: 500;
		letter-spacing: 0.3px;
	}

	/* Responsive adjustments */
	@media (max-width: 1024px) {
		.file-overview {
			grid-template-columns: 1fr;
			gap: var(--space-md);
		}

		.stats-compact {
			grid-template-columns: repeat(2, 1fr);
		}

		.charts-grid {
			height: 72vh;
			min-height: 500px;
			padding-bottom: 1.5rem;
		}
	}

	@media (max-width: 768px) {
		.stats-compact {
			grid-template-columns: 1fr;
		}

		.file-overview {
			padding: var(--space-sm) var(--space-md);
		}

		.charts-grid {
			height: 68vh;
			min-height: 450px;
			padding-bottom: 1rem;
		}

		.chart-wrapper {
			padding-bottom: var(--space-lg);
		}
	}

	/* Visualization styles */
	.charts-grid {
		height: 78vh;
		min-height: 580px;
		margin-bottom: 3rem;
		padding-bottom: 2rem;
	}
	
	.chart-panel {
		height: 100%;
		width: 100%;
		padding: var(--space-xs);
		overflow: visible;
		box-sizing: border-box;
		display: flex;
	}
	
	.chart-card {
		background-color: var(--bg-secondary);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		padding: var(--space-sm) var(--space-sm) var(--space-xs) var(--space-sm);
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		overflow: visible;
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
		overflow: visible;
		padding-bottom: calc(var(--space-lg) + var(--space-md));
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
	
	/* Global SplitPane styles */
	:global(.splitpane-container) {
		overflow: hidden !important;
	}
	
	:global(.pane) {
		height: 100%;
		overflow: visible;
		box-sizing: border-box;
		display: flex;
	}
	
	:global(.pane > div) {
		height: 100%;
		overflow: visible;
		box-sizing: border-box;
		flex: 1;
	}
	
	:global(.splitpane-wrapper) {
		overflow: hidden !important;
	}
	
	/* Chart text styles */
	:global(svg text) {
		font-size: calc(0.6rem + 0.3vmin);
		fill: var(--text-primary);
	}
	
	:global(.chart-title),
	:global(.axis-title),
	:global(.axis-label),
	:global(.tick text),
	:global(.legend text),
	:global(.chart-label),
	:global(.x-axis text),
	:global(.y-axis text) {
		fill: var(--text-primary) !important;
		color: var(--text-primary) !important;
	}
	
	:global(.y-axis-label),
	:global(.x-axis-label) {
		fill: var(--text-primary) !important;
		font-weight: 500;
	}
	
	:global(.axis-arrow) {
		fill: var(--text-secondary) !important;
		font-weight: bold;
	}
	
	:global(.data-point:hover) {
		r: 6 !important;
	}
	
	:global(.x-axis), :global(.y-axis) {
		shape-rendering: crispEdges; 
	}
	
	:global(.x-axis path), :global(.y-axis path) {
		stroke: var(--border-secondary);
		stroke-width: 1px;
	}
	
	:global(.x-axis line), :global(.y-axis line) {
		stroke: var(--border-secondary);
		stroke-width: 1px;
	}
	
	:global(.x-axis .tick line) {
		stroke: var(--border-primary);
	}
  
	:global(.y-axis .tick line) {
		stroke: var(--border-primary);
	}
	
	:global(svg) {
		overflow: visible;
	}
</style> 