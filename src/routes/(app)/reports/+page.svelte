<script lang="ts">
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	import { reportsApi, formatDate, formatDateTime } from '$lib/pocketbase';
	import { tick } from 'svelte';
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';
	import { ChevronUp, ChevronDown, Database, Clock, CheckCircle, AlertTriangle, Download, RefreshCw } from 'lucide-svelte';

	// Define Report interface based on the API response
	interface Report {
		id: string;
		report_name: string;
		report_title: string;
		report_date: string;
		dist_mains_length: number;
		dist_mains_covered_length: number;
		dist_mains_coverage: number;
		surveyor_unit_desc?: string;
		report_final: boolean | number | string;
		indicationsCount?: number;
		fieldOfViewGapsCount?: number;
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

	// Filter state
	let reportFilter = $state('final'); // 'final', 'all', 'draft' - default to final reports only
	let searchQuery = $state(''); // Search query

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
		// Filter reports based on the toggle state and search query
		let filteredReports = [...reports];
		
		// Filter by draft/final status
		if (reportFilter === 'final') {
			// Only show final reports
			filteredReports = filteredReports.filter(report => 
				report.report_final === true || 
				report.report_final === 1 || 
				report.report_final === '1'
			);
		} else if (reportFilter === 'draft') {
			// Only show draft reports
			filteredReports = filteredReports.filter(report => 
				report.report_final === false || 
				report.report_final === 0 || 
				report.report_final === '0' ||
				!report.report_final
			);
		}
		// If reportFilter === 'all', show all reports (no filtering needed)
		
		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filteredReports = filteredReports.filter(report => 
				report.report_name?.toLowerCase().includes(query) ||
				report.report_title?.toLowerCase().includes(query) ||
				report.surveyor_unit_desc?.toLowerCase().includes(query) ||
				report.report_date?.toLowerCase().includes(query)
			);
		}
		
		displayedReports = filteredReports.sort((a, b) => {
			let valueA = a[sortColumn];
			let valueB = b[sortColumn];

			// Special case for formatting dates for comparison
			if (sortColumn === 'report_date') {
				valueA = new Date(valueA).getTime();
				valueB = new Date(valueB).getTime();
			}
			
			// Special case for numeric fields
			if (sortColumn === 'dist_mains_length' || 
                sortColumn === 'dist_mains_covered_length' || 
                sortColumn === 'dist_mains_coverage' ||
                sortColumn === 'indicationsCount' || 
                sortColumn === 'fieldOfViewGapsCount' ||
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

	// Export functionality
	async function exportToExcel() {
		try {
			// Dynamically import the xlsx library
			const XLSX = await import('xlsx');
			
			// Sort reports by report title (1st column) before exporting
			const sortedReports = [...displayedReports].sort((a, b) => {
				const titleA = (a.report_title || '').toLowerCase();
				const titleB = (b.report_title || '').toLowerCase();
				return titleA.localeCompare(titleB);
			});

			// Prepare data for export (using sorted reports)
			const exportData = sortedReports.map(report => ({
				'Boundaries Surveyed': report.report_title || '',
				'Report name': report.report_name || '',
				'Network size': report.dist_mains_length ? Number(report.dist_mains_length).toFixed(2) : '',
				'Network covered': report.dist_mains_covered_length ? Number(report.dist_mains_covered_length).toFixed(2) : '',
				'Average coverage (%)': report.dist_mains_coverage ? (Number(report.dist_mains_coverage) * 100).toFixed(2) : '',
				'Gaps': report.fieldOfViewGapsCount || 0,
				'LISA': report.indicationsCount || 0,
				'Leaks Found': '',
				'In Progress': '',
				'No Gas Found': '',
				'Not Started': '',
				'SE Found': ''
			}));

			// Calculate totals for Network size, Network covered, LISA, and Gaps
			const networkSizeTotal = sortedReports.reduce((sum, report) => {
				return sum + (Number(report.dist_mains_length) || 0);
			}, 0);
			
			const networkCoveredTotal = sortedReports.reduce((sum, report) => {
				return sum + (Number(report.dist_mains_covered_length) || 0);
			}, 0);

			const lisaTotal = sortedReports.reduce((sum, report) => {
				return sum + (Number(report.indicationsCount) || 0);
			}, 0);

			const gapsTotal = sortedReports.reduce((sum, report) => {
				return sum + (Number(report.fieldOfViewGapsCount) || 0);
			}, 0);

			// Add SUM row to the export data
			const exportDataWithTotals = [
				...exportData,
				{
					'Boundaries Surveyed': 'TOTAL',
					'Report name': '',
					'Network size': networkSizeTotal.toFixed(2),
					'Network covered': networkCoveredTotal.toFixed(2),
					'Average coverage (%)': '',
					'Gaps': gapsTotal,
					'LISA': lisaTotal,
					'Leaks Found': '',
					'In Progress': '',
					'No Gas Found': '',
					'Not Started': '',
					'SE Found': ''
				}
			];

			// Create workbook with cellStyles enabled
			const wb = XLSX.utils.book_new();
			wb.Props = {
				Title: "GNI Reports Export",
				Subject: "Survey Reports",
				Author: "GNI System",
				CreatedDate: new Date()
			};

			// Build the worksheet data as an array of arrays (AOA) format
			const headers = Object.keys(exportDataWithTotals[0]);
			
			const aoa = [
				// Header row
				headers,
				// Data rows
				...exportDataWithTotals.map((row) => {
					return headers.map(header => row[header as keyof typeof row]);
				})
			];

			// Create worksheet from array of arrays
			const ws = XLSX.utils.aoa_to_sheet(aoa);

			// Set column widths
			ws['!cols'] = [
				{ wch: 70 }, // Boundaries Surveyed (report title) - wider
				{ wch: 20 }, // Report name
				{ wch: 15 }, // Network size
				{ wch: 16 }, // Network covered
				{ wch: 18 }, // Average coverage (%)
				{ wch: 10 }, // Gaps
				{ wch: 10 }, // LISA
				{ wch: 12 }, // Leaks Found
				{ wch: 12 }, // In Progress
				{ wch: 12 }, // No Gas Found
				{ wch: 12 }, // Not Started
				{ wch: 10 }  // SE Found
			];

			// Note: Bold formatting requires xlsx Pro edition or a different library
			// The visual markers above provide clear distinction instead

			// Add worksheet to workbook with specific options
			XLSX.utils.book_append_sheet(wb, ws, 'Reports');

			// Generate filename with current date and filter info
			const now = new Date();
			const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD format
			const filterInfo = reportFilter === 'all' ? 'All' : reportFilter === 'draft' ? 'Draft' : 'Final';
			const searchInfo = searchQuery ? `_Search-${searchQuery.replace(/[^a-zA-Z0-9]/g, '')}` : '';
			const filename = `GNI_Reports_${filterInfo}${searchInfo}_${timestamp}.xlsx`;

			// Write and download file
			XLSX.writeFile(wb, filename);
			
			console.log(`Exported ${exportData.length} reports (+ totals row with Network size, Network covered, and LISA totals) to ${filename}`);
		} catch (error) {
			console.error('Error exporting to Excel:', error);
			alert('Error exporting to Excel. Please try again.');
		}
	}

	// Reactive statement to re-sort when filters change
	$effect(() => {
		// Re-sort when includeDraftReports or searchQuery changes
		reportFilter;
		searchQuery;
		sortReports();
	});

	// Calculate total survey distance
	const totalSurveyDistance = $derived(() => {
		return reports.reduce((sum, report) => {
			return sum + (parseFloat(report.total_distance_km || '0') || 0);
		}, 0);
	});

	// Calculate total coverage (from final reports only)
	const totalCoverage = $derived(() => {
		const finalReportsOnly = reports.filter(report => 
			report.report_final === true || 
			report.report_final === 1 || 
			report.report_final === '1'
		);
		const totalAssets = finalReportsOnly.reduce((sum, report) => sum + (report.dist_mains_length || 0), 0);
		const coveredAssets = finalReportsOnly.reduce((sum, report) => sum + (report.dist_mains_covered_length || 0), 0);
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
				// totalIndications already comes from final reports only (calculation reports)
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

<PageTemplate title={t('reports.title', $language)} fullWidth={true}>
	{#snippet pageActions()}
		<button 
			class="button button--primary" 
			onclick={exportToExcel}
		>
			<Download size={18} />
			Export Reports
		</button>
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
	{/snippet}
	
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
								<div class="stats-label">Coverage (Final)</div>
							</div>
						</div>
						
						<div class="stats-metric">
							<div class="stats-content">
								<div class="stats-value">{totalLISAs}</div>
								<div class="stats-label">LISAs (Final)</div>
							</div>
						</div>
					</div>

					<!-- Filter Controls -->
					<div class="filter-controls">
						<div class="filter-row">
							<div class="filter-item filter-item--radio-group">
								<span class="filter-group-label">Report Type:</span>
								<div class="radio-group">
									<label class="radio-option">
										<input 
											type="radio" 
											name="reportFilter" 
											value="final" 
											bind:group={reportFilter}
										>
										<span class="radio-indicator"></span>
										<span class="radio-label">Final Reports Only</span>
										<span class="radio-count">({finalReports})</span>
									</label>
									
									<label class="radio-option">
										<input 
											type="radio" 
											name="reportFilter" 
											value="all" 
											bind:group={reportFilter}
										>
										<span class="radio-indicator"></span>
										<span class="radio-label">All Reports</span>
										<span class="radio-count">({totalReports})</span>
									</label>
									
									<label class="radio-option">
										<input 
											type="radio" 
											name="reportFilter" 
											value="draft" 
											bind:group={reportFilter}
										>
										<span class="radio-indicator"></span>
										<span class="radio-label">Draft Reports Only</span>
										<span class="radio-count">({draftReports})</span>
									</label>
								</div>
							</div>
						</div>

						<div class="filter-row">
							<div class="filter-item">
								<label class="search-label" for="search-input">Search Reports:</label>
								<input 
									id="search-input"
									type="text" 
									class="search-input"
									placeholder="Search by name, title, unit, or date..."
									bind:value={searchQuery}
								>
							</div>
						</div>
					</div>



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
																			<th class="table__header table__header--sortable" onclick={() => handleSort('dist_mains_covered_length')}>
										<div class="sort-header">
											<span>Assets Covered</span>
											{#if sortColumn === 'dist_mains_covered_length'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th class="table__header table__header--sortable" onclick={() => handleSort('dist_mains_length')}>
										<div class="sort-header">
											<span>Total Assets</span>
											{#if sortColumn === 'dist_mains_length'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th class="table__header table__header--sortable" onclick={() => handleSort('dist_mains_coverage')}>
										<div class="sort-header">
											<span>Coverage %</span>
											{#if sortColumn === 'dist_mains_coverage'}
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
												<span>Vehicle</span>
												{#if sortColumn === 'surveyor_unit_desc'}
													{#if sortDirection === 'asc'}
														<ChevronUp size={14} class="table__sort-icon" />
													{:else}
														<ChevronDown size={14} class="table__sort-icon" />
													{/if}
												{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('fieldOfViewGapsCount')}>
											<div class="sort-header">
												<span>Gaps</span>
												{#if sortColumn === 'fieldOfViewGapsCount'}
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
												<td class="table__cell">{report.dist_mains_covered_length ? `${Number(report.dist_mains_covered_length).toFixed(2)} km` : 'N/A'}</td>
												<td class="table__cell">{report.dist_mains_length ? `${Number(report.dist_mains_length).toFixed(2)} km` : 'N/A'}</td>
												<td class="table__cell">{report.dist_mains_coverage ? `${Number(report.dist_mains_coverage * 100).toFixed(1)}%` : 'N/A'}</td>
												<td class="table__cell">{report.formatted_duration || 'N/A'}</td>
												<td class="table__cell table__cell--highlight">{report.total_distance_km ? `${report.total_distance_km} km` : 'N/A'}</td>
												<td class="table__cell">{report.surveyor_unit_desc || 'N/A'}</td>
												<td class="table__cell table__cell--center">{report.fieldOfViewGapsCount || 0}</td>
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
											<td class="table__cell table__cell--empty" colspan="12">No reports found</td>
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

	/* Filter Controls */
	.filter-controls {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.filter-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.filter-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.filter-item--radio-group {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.filter-group-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.radio-group {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.radio-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
		position: relative;
	}

	.radio-option input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.radio-indicator {
		width: 16px;
		height: 16px;
		border: 2px solid var(--border-primary);
		border-radius: 50%;
		background: white;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.radio-option input:checked + .radio-indicator {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
		box-shadow: inset 0 0 0 3px white;
	}

	.radio-option:hover .radio-indicator {
		border-color: var(--accent-primary);
	}

	.radio-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.radio-count {
		font-size: 0.7rem;
		color: var(--text-secondary);
		font-style: italic;
	}

	.radio-option input:checked + .radio-indicator + .radio-label {
		font-weight: 600;
		color: var(--accent-primary);
	}

	.radio-option input:checked + .radio-indicator + .radio-label + .radio-count {
		color: var(--accent-primary);
	}

	/* Search Input */
	.search-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.search-input {
		width: 300px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-primary);
		border-radius: 4px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.85rem;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
	}

	.search-input::placeholder {
		color: var(--text-secondary);
		opacity: 0.7;
	}

	/* Toggle Switch */
	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
		cursor: pointer;
	}

	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: var(--border-primary);
		border-radius: 24px;
		transition: background-color 0.2s ease;
	}

	.toggle-slider:before {
		position: absolute;
		content: "";
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		border-radius: 50%;
		transition: transform 0.2s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.toggle-switch input:checked + .toggle-slider {
		background-color: var(--accent-primary);
	}

	.toggle-switch input:checked + .toggle-slider:before {
		transform: translateX(20px);
	}

	.toggle-switch:hover .toggle-slider {
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
	}

	/* Sync Info in Page Actions */
	.sync-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
		background: var(--bg-secondary);
		padding: 0.5rem 0.75rem;
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
		min-width: 1560px; /* Increased for the new Gaps column (was 1450px) */
		table-layout: fixed; /* Force table to respect column widths */
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

	/* Optimized columns for report name (short codes) and title */
	.table__header--report-name {
		min-width: 100px !important;
		max-width: 100px !important;
		width: 100px !important;
	}

	.table__header--report-title {
		min-width: 400px !important;
		max-width: 400px !important;
		width: 400px !important;
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
		min-width: 100px !important;
		max-width: 100px !important;
		width: 100px !important;
		position: relative;
		cursor: help;
		overflow: hidden;
	}

	.table__cell--report-title {
		min-width: 400px !important;
		max-width: 400px !important;
		width: 400px !important;
		position: relative;
		cursor: help;
		overflow: hidden;
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

	/* Responsive Filter Controls */
	@media (max-width: 768px) {
		.filter-row {
			flex-direction: column;
			align-items: stretch;
			gap: 1rem;
		}

		.filter-item {
			justify-content: space-between;
		}

		.filter-item--radio-group {
			flex-direction: row;
			align-items: center;
			gap: 1.5rem;
			flex-wrap: wrap;
		}

		.radio-group {
			flex-direction: row;
			align-items: center;
			gap: 1.5rem;
			flex-wrap: wrap;
		}

		.radio-option {
			flex-direction: row;
			align-items: center;
			gap: 0.5rem;
		}

		.search-input {
			width: 100%;
			max-width: none;
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