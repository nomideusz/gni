<script lang="ts">
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	import { reportsApi, formatDate, formatDateTime } from '$lib/pocketbase';
	import { tick } from 'svelte';

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
	let syncInfo = $state<any>(null);
	
	let reports = $state<Report[]>([]);
	let displayedReports = $state<Report[]>([]);
	let loading = $state(true);
	let reportsLoading = $state(true);
	let error = $state('');
	let meta = $state({ page: 1, totalPages: 0, totalItems: 0, perPage: 0 });
	let tableContainer: HTMLElement;

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

<div class="page-layout">
	<div class="page-layout__container">
		<div class="page-content">
			<div class="page-header">
				<h1 class="page-header__title">{t('reports.title', $language)}</h1>
				<p class="page-header__description">{t('reports.description', $language)}</p>
			</div>

			<div class="panel-container">
				<div class="page-subheader">
					<h2 class="page-subheader__title">
						{t('reports.title', $language)}
						{#if !loading && !error}
							<span class="page-subheader__status-counts">
								{t('reports.status.final', $language)}: {finalReports} • {t('reports.status.total', $language)}: {totalReports} • {t('reports.status.draft', $language)}: {draftReports}
							</span>
						{/if}
					</h2>
					
					<div class="page-subheader__actions">
						{#if syncInfo === null}
							<div class="sync sync--loading">
								<span>{t('reports.sync.loading', $language) || 'Loading sync status...'}</span>
								<div class="sync-loading-indicator">
									<div class="sync-loading-dot"></div>
									<div class="sync-loading-dot"></div>
									<div class="sync-loading-dot"></div>
								</div>
							</div>
						{:else if syncInfo}
							<div class="sync">
								{t('reports.sync.lastSynced', $language)}: {syncInfo.last_sync 
									? formatDateTime(syncInfo.last_sync) 
									: (syncInfo.last_sync_success 
										? formatDateTime(syncInfo.last_sync_success) 
										: t('reports.sync.never', $language))}
								<span class="sync__status sync__status--{syncInfo.sync_status || 'pending'}">{syncInfo.sync_status || t('reports.sync.unknown', $language)}</span>
							</div>
						{:else}
							<div class="sync">
								<span>{t('reports.sync.unavailable', $language)}</span>
							</div>
						{/if}
					</div>
				</div>

				<div class="content">
					<div class="data-display">
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
							<p class="error">{error}</p>
						{:else if reportsLoading}
							<div class="table-container" bind:this={tableContainer}>
								<div class="table table--scrollable">
									<table class="table__element">
										<thead>
											<tr>
												<th class="table__header table__header--sortable">{t('reports.table.reportName', $language)}</th>
												<th class="table__header table__header--sortable">{t('reports.table.reportTitle', $language)}</th>
												<th class="table__header table__header--sortable">{t('reports.table.date', $language)}</th>
												<th class="table__header table__header--sortable">{t('reports.table.assetsCovered', $language)}</th>
												<th class="table__header table__header--sortable">Total Assets</th>
												<th class="table__header table__header--sortable">Coverage %</th>
												<th class="table__header table__header--sortable">Duration</th>
												<th class="table__header table__header--sortable" style="font-weight: bold;">Survey Distance</th>
												<th class="table__header table__header--sortable">{t('reports.table.surveyorUnit', $language)}</th>
												<th class="table__header table__header--sortable">{t('reports.table.lisa', $language)}</th>
												<th class="table__header table__header--sortable table__header--status">{t('reports.table.status', $language)}</th>
											</tr>
										</thead>
										<tbody>
											<!-- Skeleton loading rows -->
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
										</tbody>
									</table>
								</div>
							</div>
						{:else}
							<div class="table-container" bind:this={tableContainer}>
								<div class="table table--scrollable">
									<table class="table__element">
										<thead>
											<tr>
												<th class="table__header table__header--sortable" onclick={() => handleSort('report_name')}>
													{t('reports.table.reportName', $language)}
													<span class="table__sort-icon">{sortColumn === 'report_name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th> 
												<th class="table__header table__header--sortable" onclick={() => handleSort('report_title')}>
													{t('reports.table.reportTitle', $language)}
													<span class="table__sort-icon">{sortColumn === 'report_title' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th> 
												<th class="table__header table__header--sortable" onclick={() => handleSort('report_date')}>
													{t('reports.table.date', $language)}
													<span class="table__sort-icon">{sortColumn === 'report_date' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th> 
												<th class="table__header table__header--sortable" onclick={() => handleSort('linear_asset_covered_length')}>
													{t('reports.table.assetsCovered', $language)}
													<span class="table__sort-icon">{sortColumn === 'linear_asset_covered_length' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th>
												<th class="table__header table__header--sortable" onclick={() => handleSort('linear_asset_length')}>
													Total Assets
													<span class="table__sort-icon">{sortColumn === 'linear_asset_length' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th>
												<th class="table__header table__header--sortable" onclick={() => handleSort('linear_asset_coverage')}>
													Coverage %
													<span class="table__sort-icon">{sortColumn === 'linear_asset_coverage' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th>
												<th class="table__header table__header--sortable" onclick={() => handleSort('total_duration_seconds')}>
													Duration
													<span class="table__sort-icon">{sortColumn === 'total_duration_seconds' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th>
												<th class="table__header table__header--sortable" onclick={() => handleSort('total_distance_km')} style="font-weight: bold;">
													Survey Distance
													<span class="table__sort-icon">{sortColumn === 'total_distance_km' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th>
												<th class="table__header table__header--sortable" onclick={() => handleSort('surveyor_unit_desc')}>
													{t('reports.table.surveyorUnit', $language)}
													<span class="table__sort-icon">{sortColumn === 'surveyor_unit_desc' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th> 
												<th class="table__header table__header--sortable" onclick={() => handleSort('indicationsCount')}>
													{t('reports.table.lisa', $language)}
													<span class="table__sort-icon">{sortColumn === 'indicationsCount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th> 
												<th class="table__header table__header--sortable table__header--status" onclick={() => handleSort('report_final')}>
													{t('reports.table.status', $language)}
													<span class="table__sort-icon">{sortColumn === 'report_final' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</span>
												</th> 
											</tr>
										</thead>
										<tbody>
											{#if displayedReports.length > 0}
												{#each displayedReports as report}
													<tr class="table__row">
														<td class="table__cell">{report.report_name}</td>
														<td class="table__cell">{report.report_title}</td>
														<td class="table__cell">{formatDate(report.report_date)}</td>
														<td class="table__cell">{report.linear_asset_covered_length ? `${Number(report.linear_asset_covered_length).toFixed(2)} km` : 'N/A'}</td>
														<td class="table__cell">{report.linear_asset_length ? `${Number(report.linear_asset_length).toFixed(2)} km` : 'N/A'}</td>
														<td class="table__cell">{report.linear_asset_coverage ? `${Number(report.linear_asset_coverage * 100).toFixed(1)}%` : 'N/A'}</td>
														<td class="table__cell">{report.formatted_duration || 'N/A'}</td>
														<td class="table__cell highlight-column">{report.total_distance_km ? `${report.total_distance_km} km` : 'N/A'}</td>
														<td class="table__cell">{report.surveyor_unit_desc || 'N/A'}</td>
														<td class="table__cell">{report.indicationsCount || 0}</td>
														<td class="table__cell table__cell--status">
															<span class="status status--{
																report.report_final === true || 
																report.report_final === 1 || 
																report.report_final === '1' ? 'final' : 'draft'
															}">
																{report.report_final === true || 
																report.report_final === 1 || 
																report.report_final === '1' ? t('reports.status.final', $language) : t('reports.status.draft', $language)}
															</span>
														</td>
													</tr>
												{/each}
											{:else}
												<tr class="table__row">
													<td class="table__cell" colspan="11">{t('reports.table.noReportsFound', $language)}</td>
												</tr>
											{/if}
										</tbody>
									</table>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.sync--loading {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	
	.sync-loading-indicator {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	
	.sync-loading-dot {
		width: 6px;
		height: 6px;
		background-color: #666;
		border-radius: 50%;
		animation: pulse 1.5s infinite ease-in-out;
	}
	
	.sync-loading-dot:nth-child(2) {
		animation-delay: 0.5s;
	}
	
	.sync-loading-dot:nth-child(3) {
		animation-delay: 1s;
	}
	
	@keyframes pulse {
		0%, 100% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.2);
			opacity: 1;
		}
	}

	/* Table scrolling fixes */
	.table-container {
		width: 100%;
		overflow-x: auto;
		padding-bottom: 15px;
		margin-bottom: 20px;
		position: relative;
	}

	/* Override the global panel-container content styles */
	:global(.panel-container) .content {
		position: relative !important;
		overflow-y: auto !important;
		overflow-x: hidden !important;
		width: 100% !important;
		height: auto !important;
		min-height: 500px !important;
		padding-bottom: 20px !important;
		top: auto !important;
		bottom: auto !important;
	}

	.data-display {
		width: 100%;
		height: auto;
	}

	/* Override global scrollable table styles */
	:global(.table.table--scrollable) {
		position: relative !important;
		top: auto !important;
		bottom: auto !important;
		left: auto !important;
		right: auto !important;
		margin-bottom: 0;
		box-shadow: var(--shadow-sm);
		border-radius: var(--radius-md);
		overflow: visible !important;
	}

	.table__element {
		width: 100%;
		border-collapse: collapse;
		min-width: 1400px;
		table-layout: fixed !important;
	}

	/* Override display properties for table elements */
	.table__element thead,
	.table__element tbody,
	.table__element tr {
		display: table !important;
		width: 100% !important;
		table-layout: fixed !important;
	}

	.table__element tbody {
		display: table-row-group !important;
		height: auto !important;
		overflow: visible !important;
	}

	/* Override cell styles */
	.table__header,
	.table__cell {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 0.8rem;
	}

	/* Define specific column widths for this table */
	.table__header:nth-child(1), .table__cell:nth-child(1) { width: 9% !important; }
	.table__header:nth-child(2), .table__cell:nth-child(2) { width: 9% !important; }
	.table__header:nth-child(3), .table__cell:nth-child(3) { width: 8% !important; }
	.table__header:nth-child(4), .table__cell:nth-child(4) { width: 8% !important; }
	.table__header:nth-child(5), .table__cell:nth-child(5) { width: 8% !important; }
	.table__header:nth-child(6), .table__cell:nth-child(6) { width: 8% !important; }
	.table__header:nth-child(7), .table__cell:nth-child(7) { width: 8% !important; }
	.table__header:nth-child(8), .table__cell:nth-child(8) { width: 10% !important; }
	.table__header:nth-child(9), .table__cell:nth-child(9) { width: 14% !important; }
	.table__header:nth-child(10), .table__cell:nth-child(10) { width: 8% !important; }
	.table__header:nth-child(11), .table__cell:nth-child(11) { width: 10% !important; }

	/* Scrollbar styles */
	.table-container::-webkit-scrollbar {
		height: 8px;
		width: 8px;
	}

	.table-container::-webkit-scrollbar-track {
		background: var(--bg-tertiary);
		border-radius: var(--radius-md);
	}

	.table-container::-webkit-scrollbar-thumb {
		background: var(--border-secondary);
		border-radius: var(--radius-md);
	}

	.table-container::-webkit-scrollbar-thumb:hover {
		background: var(--accent-primary);
	}

	/* For Firefox */
	.table-container {
		scrollbar-width: thin;
		scrollbar-color: var(--border-secondary) var(--bg-tertiary);
	}

	/* Highlight distance column */
	.highlight-column {
		font-weight: bold;
		background-color: rgba(0, 0, 0, 0.03);
	}

	/* Ensure adequate spacing for status column */
	.table__cell--status {
		text-align: center;
		white-space: nowrap;
	}
</style>