<script lang="ts">
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	import { reportsApi, formatDate, formatDateTime } from '$lib/pocketbase';
	import { tick } from 'svelte';
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';
	import { ChevronUp, ChevronDown, Database, Clock, CheckCircle, AlertTriangle } from 'lucide-svelte';

	// Define Report interface based on the API response
	interface Report {
		id: string;
		report_name: string;
		report_title: string;
		report_date: string;
		linear_asset_length: number;
		linear_asset_covered_length: number;
		linear_asset_coverage: number;
		surveyor_unit_desc?: string;
		report_final: boolean | number | string;
		indicationsCount?: number;
		driving_sessions?: any[];
		total_duration_seconds?: number;
		formatted_duration?: string;
		total_distance_km?: string;
		expand?: {
			driving_sessions?: any[];
			indications_via_report?: any[];
		};
		[key: string]: any; // Allow other properties
	}

	// Stats and sync info
	let finalReports = $state(0);
	let totalReports = $state(0);
	let draftReports = $state(0);
	let totalLISAs = $state(0);
	let syncInfo = $state<any>(null);
	
	let reports = $state<Report[]>([]);
	let displayedReports = $state<Report[]>([]);
	let loading = $state(true);
	let reportsLoading = $state(true);
	let error = $state('');
	let meta = $state({ page: 1, totalPages: 0, totalItems: 0, perPage: 0 });
	let tableContainer = $state<HTMLElement>();

	// Sorting state
	let sortColumn = $state('report_date');
	let sortDirection = $state('desc'); // 'asc' or 'desc'

	// Function to force scrollbar refresh - modified to be more reliable
	async function refreshScrollbars() {
		// Wait for DOM update
		await tick();
		
		// More reliable scrollbar handling
		if (tableContainer) {
			// Get the actual table width
			const tableElement = tableContainer.querySelector('.table__element');
			const tableWidth = tableElement?.getBoundingClientRect().width || 0;
			const containerWidth = tableContainer.getBoundingClientRect().width;
			
			// If table is wider than container, ensure horizontal scrolling is enabled
			if (tableWidth > containerWidth) {
				tableContainer.style.overflowX = 'auto';
				
				// Force a reflow to ensure scrollbars appear
				/* eslint-disable no-unused-expressions */
				tableContainer.scrollLeft;
				tableContainer.scrollLeft = 0;
			}
		}
		
		// Schedule another refresh after a short delay to catch any delayed rendering
		setTimeout(() => {
			if (tableContainer) {
				const tableElement = tableContainer.querySelector('.table__element');
				if (tableElement) {
					// Force a reflow again to ensure scrollbars appear
					/* eslint-disable no-unused-expressions */
					tableContainer.scrollLeft;
					tableContainer.scrollLeft = 0;
				}
			}
		}, 100);
	}

	// Sort the reports based on current sort column and direction
	function sortReports() {
		displayedReports = [...reports].sort((a, b) => {
			let valueA = a[sortColumn];
			let valueB = b[sortColumn];

			// Special case for formatting dates for comparison
			if (sortColumn === 'report_date') {
				valueA = new Date(valueA).getTime();
				valueB = new Date(valueB).getTime();
			}
			
			// Special case for numeric fields
			if (sortColumn === 'linear_asset_length' || 
                sortColumn === 'linear_asset_covered_length' || 
                sortColumn === 'linear_asset_coverage' ||
                sortColumn === 'indicationsCount' || 
                sortColumn === 'total_duration_seconds' ||
                sortColumn === 'total_distance_km') {
				valueA = Number(valueA) || 0;
				valueB = Number(valueB) || 0;
			}

			// Handle boolean/number/string report_final field
			if (sortColumn === 'report_final') {
				valueA = Boolean(valueA) ? 1 : 0;
				valueB = Boolean(valueB) ? 1 : 0;
			}

			// Handle comparison based on sort direction
			if (sortDirection === 'asc') {
				return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
			} else {
				return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
			}
		});
		
		// Refresh scrollbars after sorting
		refreshScrollbars();
	}

	// Handle column header click to change sort
	function handleSort(column: string) {
		if (sortColumn === column) {
			// Toggle direction if same column
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// New column, default to descending for dates, ascending for others
			sortColumn = column;
			sortDirection = column === 'report_date' ? 'desc' : 'asc';
		}
		sortReports();
	}

	// Calculate total survey distance
	const totalSurveyDistance = $derived(() => {
		return reports.reduce((sum, report) => {
			return sum + (parseFloat(report.total_distance_km || '0') || 0);
		}, 0);
	});

	// Calculate total coverage
	const totalCoverage = $derived(() => {
		const totalAssets = reports.reduce((sum, report) => sum + (report.linear_asset_length || 0), 0);
		const coveredAssets = reports.reduce((sum, report) => sum + (report.linear_asset_covered_length || 0), 0);
		return totalAssets > 0 ? (coveredAssets / totalAssets) * 100 : 0;
	});

	onMount(() => {
		const loadData = async () => {
			try {
				// Fetch reports using our API service
				const result = await reportsApi.getAll({
					limit: 500,
					page: 1,
					sort: '-report_date',
					finalOnly: false, // Show all reports including drafts
					includeUnitDesc: true, // Include unit descriptions
					withSurveys: true // Only show reports with surveys
				});

				// Log the first report to debug structure
				if (result.reports.length > 0) {
					console.log('First report structure:', result.reports[0]);
				}
				
				// We no longer need to filter for driving sessions as the API does this for us
				reports = result.reports;
				meta = result.meta;
				
				// Apply initial sorting
				sortReports();
				
				// Use the stats data from the API
				totalReports = result.stats.totalReports;
				finalReports = result.stats.reportCounts.finalWithSurveys;
				draftReports = totalReports - finalReports;
				totalLISAs = result.stats.totalIndications || 0;
				
				// Fetch sync info from centralized API
				try {
					const syncResponse = await fetch('/api/v1/sync-status');
					if (syncResponse.ok) {
						syncInfo = await syncResponse.json();
						console.log('Sync info from API:', syncInfo);
					} else {
						console.error('Error fetching sync status:', syncResponse.status, syncResponse.statusText);
					}
				} catch (syncErr) {
					console.error('Error fetching sync status:', syncErr);
				}
				
				console.log(`Loaded ${reports.length} reports with driving sessions (calculation reports: ${result.meta.calculationReportsCount})`);
			} catch (err) {
				console.error('Error fetching reports:', err);
				error = t('reports.error', $language);
			} finally {
				loading = false;
				reportsLoading = false;
				
				// Multiple attempts at refreshing scrollbars to ensure they appear
				refreshScrollbars();
				setTimeout(refreshScrollbars, 100);
				setTimeout(refreshScrollbars, 500);
				setTimeout(refreshScrollbars, 1000);
			}
		};
		
		loadData();
		
		// Add window resize listener to handle responsive behavior
		const handleResize = () => {
			refreshScrollbars();
		};
		
		window.addEventListener('resize', handleResize);
		
		// Return cleanup function directly
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<PageTemplate title={t('reports.title', $language)} showActions={false} fullWidth={true}>
	{#snippet content()}
		<SectionContainer
			title="Survey Reports Overview"
			subtitle="Comprehensive analysis of survey data and asset coverage"
			width="full"
		>
			{#snippet children()}
				{#if loading}
					<div class="loading-container">
						<div class="loading-indicator">
							<div class="loading-bar"></div>
							<div class="loading-bar"></div>
							<div class="loading-bar"></div>
						</div>
						<p class="loading-text">{t('reports.loading', $language)}</p>
					</div>
				{:else if error}
					<div class="error-container">
						<p class="error">{error}</p>
					</div>
				{:else}
					<!-- Stats Header -->
					<div class="stats-header">
						<div class="stats-metric stats-metric--primary">
							<div class="stats-icon">
								<Database size={24} />
							</div>
							<div class="stats-content">
								<div class="stats-value">{totalReports}</div>
								<div class="stats-label">Total Reports</div>
							</div>
						</div>
						
						<div class="stats-metric">
							<div class="stats-icon stats-icon--success">
								<CheckCircle size={20} />
							</div>
							<div class="stats-content">
								<div class="stats-value">{finalReports}</div>
								<div class="stats-label">Final Reports</div>
							</div>
						</div>
						
						<div class="stats-metric">
							<div class="stats-icon stats-icon--warning">
								<AlertTriangle size={20} />
							</div>
							<div class="stats-content">
								<div class="stats-value">{draftReports}</div>
								<div class="stats-label">Draft Reports</div>
							</div>
						</div>
						
						<div class="stats-metric">
							<div class="stats-content">
								<div class="stats-value">{totalCoverage().toFixed(1)}%</div>
								<div class="stats-label">Asset Coverage</div>
							</div>
						</div>
						
						<div class="stats-metric">
							<div class="stats-content">
								<div class="stats-value">{totalLISAs}</div>
								<div class="stats-label">Total LISAs</div>
							</div>
						</div>
					</div>

					<!-- Sync Status -->
					{#if syncInfo !== null}
						<div class="sync-status">
							<div class="sync-status-content">
								<Clock size={16} />
								<span>Last Sync: {syncInfo.last_sync 
									? formatDateTime(syncInfo.last_sync) 
									: (syncInfo.last_sync_success 
										? formatDateTime(syncInfo.last_sync_success) 
										: 'Never')}</span>
								<span class="sync-badge sync-badge--{syncInfo.sync_status || 'pending'}">
									{syncInfo.sync_status || 'Unknown'}
								</span>
							</div>
						</div>
					{/if}

					<p class="table-scroll-hint">Scroll horizontally to view all report data</p>
					
					<div class="table-container" bind:this={tableContainer}>
						<div class="table table--compact">
							<table class="table__element">
								<thead>
									<tr>
										<th class="table__header table__header--sortable table__header--report-name" onclick={() => handleSort('report_name')}>
											<div class="sort-header">
												<span>Report Name</span>
												{#if sortColumn === 'report_name'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable table__header--report-title" onclick={() => handleSort('report_title')}>
											<div class="sort-header">
												<span>Report Title</span>
												{#if sortColumn === 'report_title'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('report_date')}>
											<div class="sort-header">
												<span>Report Date</span>
												{#if sortColumn === 'report_date'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('linear_asset_covered_length')}>
											<div class="sort-header">
												<span>Assets Covered</span>
												{#if sortColumn === 'linear_asset_covered_length'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('linear_asset_length')}>
											<div class="sort-header">
												<span>Total Assets</span>
												{#if sortColumn === 'linear_asset_length'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('linear_asset_coverage')}>
											<div class="sort-header">
												<span>Coverage %</span>
												{#if sortColumn === 'linear_asset_coverage'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('total_duration_seconds')}>
											<div class="sort-header">
												<span>Duration</span>
												{#if sortColumn === 'total_duration_seconds'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('total_distance_km')}>
											<div class="sort-header">
												<span>Survey Distance</span>
												{#if sortColumn === 'total_distance_km'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('surveyor_unit_desc')}>
											<div class="sort-header">
												<span>Surveyor Unit</span>
												{#if sortColumn === 'surveyor_unit_desc'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('indicationsCount')}>
											<div class="sort-header">
												<span>LISAs</span>
												{#if sortColumn === 'indicationsCount'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('report_final')}>
											<div class="sort-header">
												<span>Status</span>
												{#if sortColumn === 'report_final'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
									</tr>
								</thead>
								<tbody>
									{#if reportsLoading}
										{#each Array(5) as _, i}
											<tr class="table__row table__row--loading">
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell"><div class="skeleton-text"></div></td>
												<td class="table__cell table__cell--status">
													<div class="skeleton-text"></div>
												</td>
											</tr>
										{/each}
									{:else if displayedReports.length > 0}
										{#each displayedReports as report}
											<tr class="table__row">
												<td class="table__cell table__cell--report-name" title={report.report_name}>
													<span class="table__cell-content">{report.report_name}</span>
												</td>
												<td class="table__cell table__cell--report-title" title={report.report_title}>
													<span class="table__cell-content">{report.report_title}</span>
												</td>
												<td class="table__cell">{formatDate(report.report_date)}</td>
												<td class="table__cell">{report.linear_asset_covered_length ? `${Number(report.linear_asset_covered_length).toFixed(2)} km` : 'N/A'}</td>
												<td class="table__cell">{report.linear_asset_length ? `${Number(report.linear_asset_length).toFixed(2)} km` : 'N/A'}</td>
												<td class="table__cell">{report.linear_asset_coverage ? `${Number(report.linear_asset_coverage * 100).toFixed(1)}%` : 'N/A'}</td>
												<td class="table__cell">{report.formatted_duration || 'N/A'}</td>
												<td class="table__cell table__cell--highlight">{report.total_distance_km ? `${report.total_distance_km} km` : 'N/A'}</td>
												<td class="table__cell">{report.surveyor_unit_desc || 'N/A'}</td>
												<td class="table__cell table__cell--center">{report.indicationsCount || 0}</td>
												<td class="table__cell table__cell--status">
													<div class="status-container">
														<span class="status-indicator {
															report.report_final === true || 
															report.report_final === 1 || 
															report.report_final === '1' ? 'status-indicator--final' : 'status-indicator--draft'
														}"></span>
														<span class="status-text">
															{report.report_final === true || 
															report.report_final === 1 || 
															report.report_final === '1' ? 'Final' : 'Draft'}
														</span>
													</div>
												</td>
											</tr>
										{/each}
									{:else}
										<tr class="table__row">
											<td class="table__cell table__cell--empty" colspan="11">No reports found</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			{/snippet}
		</SectionContainer>
	{/snippet}
</PageTemplate>

<style>
	/* Stats Header */
	.stats-header {
		background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 1.5rem;
		color: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.stats-metric {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.stats-metric--primary {
		grid-column: span 2;
		padding-right: 1.5rem;
		border-right: 1px solid rgba(255, 255, 255, 0.2);
	}

	.stats-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		flex-shrink: 0;
	}

	.stats-icon--success {
		background: rgba(34, 197, 94, 0.2);
	}

	.stats-icon--warning {
		background: rgba(245, 158, 11, 0.2);
	}

	.stats-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stats-value {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
	}

	.stats-label {
		font-size: 0.85rem;
		opacity: 0.9;
	}

	/* Sync Status */
	.sync-status {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		padding: 0.75rem 1rem;
		margin-bottom: 1.5rem;
	}

	.sync-status-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.sync-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.sync-badge--success {
		background: rgba(34, 197, 94, 0.1);
		color: var(--success);
	}

	.sync-badge--pending {
		background: rgba(245, 158, 11, 0.1);
		color: var(--warning);
	}

	.sync-badge--failed {
		background: rgba(239, 68, 68, 0.1);
		color: var(--error);
	}

	/* Loading States */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
	}

	.loading-indicator {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.loading-bar {
		width: 4px;
		height: 40px;
		background: var(--accent-primary);
		border-radius: 2px;
		animation: loading-pulse 1.2s infinite ease-in-out;
	}

	.loading-bar:nth-child(2) {
		animation-delay: 0.1s;
	}

	.loading-bar:nth-child(3) {
		animation-delay: 0.2s;
	}

	@keyframes loading-pulse {
		0%, 80%, 100% {
			transform: scaleY(0.4);
			opacity: 0.5;
		}
		40% {
			transform: scaleY(1);
			opacity: 1;
		}
	}

	.loading-text {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.error-container {
		padding: 2rem;
		text-align: center;
	}

	.error {
		color: var(--error);
		font-size: 0.9rem;
	}

	/* Professional Table Styles */
	.table-container {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		overflow-x: auto;
	}

	.table {
		width: 100%;
	}

	.table__element {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
		min-width: 1500px; /* Increased to accommodate wider report columns */
	}

	.table__header {
		background: var(--bg-secondary);
		padding: 0.875rem 0.75rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		border-bottom: 1px solid var(--border-primary);
		min-width: 120px;
		max-width: 200px;
		position: relative;
	}

	/* Wider columns for report name and title */
	.table__header--report-name {
		min-width: 200px;
		max-width: 300px;
		width: 250px;
	}

	.table__header--report-title {
		min-width: 300px;
		max-width: 500px;
		width: 400px;
	}

	.table__row {
		border-bottom: 1px solid var(--border-secondary);
		transition: background-color 0.15s ease;
	}

	.table__row:hover {
		background: var(--bg-secondary);
	}

	.table__row--loading {
		background: var(--bg-secondary);
	}

	.table__cell {
		padding: 0.875rem 1rem;
		vertical-align: middle;
		height: 3.5rem;
		box-sizing: border-box;
		border-right: 1px solid var(--border-secondary);
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.table__cell:last-child {
		border-right: none;
	}

	.table__cell--highlight {
		background: rgba(37, 99, 235, 0.05);
		font-weight: 600;
		color: var(--accent-primary);
	}

	.table__cell--center {
		text-align: center;
	}

	.table__cell--status {
		text-align: center;
		padding: 0.75rem;
	}

	.table__cell--empty {
		text-align: center;
		color: var(--text-secondary);
		font-style: italic;
	}

	/* Specific styling for report name and title cells */
	.table__cell--report-name {
		min-width: 200px;
		max-width: 300px;
		width: 250px;
		position: relative;
		cursor: help;
	}

	.table__cell--report-title {
		min-width: 300px;
		max-width: 500px;
		width: 400px;
		position: relative;
		cursor: help;
	}

	.table__cell-content {
		display: block;
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.4;
	}

	/* Status container styling */
	.status-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		height: 100%;
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-indicator--final {
		background: var(--success);
		box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
	}

	.status-indicator--draft {
		background: var(--warning);
		box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
	}

	.status-text {
		font-size: 0.8rem;
		font-weight: 500;
	}

	/* Sort header styling */
	.sort-header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
		cursor: pointer;
		user-select: none;
		line-height: 1.3;
	}

	.sort-header span {
		flex: 1;
		word-wrap: break-word;
		overflow-wrap: break-word;
		hyphens: auto;
	}

	.table__header--sortable {
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.table__header--sortable:hover {
		background-color: rgba(0, 0, 0, 0.05);
	}

	.table__sort-icon {
		color: var(--accent-primary);
		flex-shrink: 0;
		margin-top: 0.1rem;
		opacity: 0.8;
	}

	.table__header--sortable:hover .table__sort-icon {
		opacity: 1;
	}

	/* Skeleton loading */
	.skeleton-text {
		height: 1rem;
		background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
		background-size: 200% 100%;
		border-radius: 4px;
		animation: skeleton-loading 1.5s infinite;
	}

	@keyframes skeleton-loading {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Table scroll hint */
	.table-scroll-hint {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 1rem;
		padding: 0.5rem 0.75rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-secondary);
		border-radius: 4px;
		text-align: center;
		font-style: italic;
	}

	/* Responsive Design */
	@media (max-width: 1024px) {
		.stats-header {
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			gap: 1rem;
		}

		.stats-metric--primary {
			grid-column: span 1;
			border-right: none;
			padding-right: 0;
		}

		.stats-value {
			font-size: 1.25rem;
		}
	}

	@media (max-width: 640px) {
		.stats-header {
			grid-template-columns: 1fr 1fr;
			gap: 0.75rem;
			padding: 1rem;
		}

		.stats-value {
			font-size: 1.1rem;
		}

		.stats-label {
			font-size: 0.75rem;
		}
	}
</style>