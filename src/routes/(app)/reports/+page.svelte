<script lang="ts">
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	import { reportsApi, formatDate, formatDateTime } from '$lib/pocketbase';
	import { tick } from 'svelte';
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';
	import { ChevronUp, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Download, RefreshCw, Copy, Activity, TrendingUp } from 'lucide-svelte';

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
	let totalGaps = $state(0);
	let syncInfo = $state<any>(null);
	
	// Car data (distances only)
	let car1Distance = $state(0);
	let car2Distance = $state(0);
	let car3Distance = $state(0);
	let car4Distance = $state(0);
	
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
	
	// Accordion state - track which reports are expanded
	let expandedReports = $state<Set<string>>(new Set());
	
	// Selection state - track which reports are selected for export
	let selectedReports = $state<Set<string>>(new Set());

	// LISA modal state
	let showLisaModal = $state(false);
	let selectedReportIndications = $state<any[]>([]);
	let selectedReportName = $state('');

	// Function to toggle report expansion
	function toggleReportExpansion(reportId: string) {
		const newSet = new Set(expandedReports);
		if (newSet.has(reportId)) {
			newSet.delete(reportId);
		} else {
			newSet.add(reportId);
		}
		expandedReports = newSet;
	}

	// Selection functions
	function toggleReportSelection(reportId: string) {
		const newSet = new Set(selectedReports);
		if (newSet.has(reportId)) {
			newSet.delete(reportId);
		} else {
			newSet.add(reportId);
		}
		selectedReports = newSet;
	}

	function selectAllReports() {
		selectedReports = new Set(displayedReports.map(r => r.id));
	}

	function clearAllSelections() {
		selectedReports = new Set();
	}

	// State for copy feedback
	let copiedItems = $state(new Set());

	// Copy text to clipboard
	async function copyToClipboard(text: string, type: string, itemId: string) {
		try {
			await navigator.clipboard.writeText(text);
			console.log(`${type} copied to clipboard:`, text);
			
			// Show success feedback
			copiedItems.add(itemId);
			copiedItems = new Set(copiedItems); // Trigger reactivity
			
			// Remove feedback after 1.5 seconds
			setTimeout(() => {
				copiedItems.delete(itemId);
				copiedItems = new Set(copiedItems); // Trigger reactivity
			}, 1500);
		} catch (err) {
			console.error('Failed to copy text: ', err);
			// Fallback for older browsers
			const textArea = document.createElement('textarea');
			textArea.value = text;
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			try {
				document.execCommand('copy');
				console.log(`${type} copied to clipboard (fallback):`, text);
				
				// Show success feedback for fallback too
				copiedItems.add(itemId);
				copiedItems = new Set(copiedItems);
				setTimeout(() => {
					copiedItems.delete(itemId);
					copiedItems = new Set(copiedItems);
				}, 1500);
			} catch (fallbackErr) {
				console.error('Fallback copy failed: ', fallbackErr);
			}
			document.body.removeChild(textArea);
		}
	}

	// Check if all displayed reports are selected
	const allReportsSelected = $derived(() => {
		return displayedReports.length > 0 && displayedReports.every(r => selectedReports.has(r.id));
	});

	// Get selected reports data
	const selectedReportsData = $derived(() => {
		return displayedReports.filter(r => selectedReports.has(r.id));
	});

	// Function to open LISA modal
	function openLisaModal(report: any) {
		selectedReportIndications = report.indications || [];
		selectedReportName = report.report_name;
		showLisaModal = true;
	}

	// Function to close LISA modal
	function closeLisaModal() {
		showLisaModal = false;
		selectedReportIndications = [];
		selectedReportName = '';
	}

	// Handle keyboard events for modal
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && showLisaModal) {
			closeLisaModal();
		}
	}

	// Add keyboard event listener
	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});

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
			
			// Use selected reports if any are selected, otherwise use all displayed reports
			const reportsToExport = selectedReports.size > 0 ? selectedReportsData() : displayedReports;
			
			// Sort reports by report title (1st column) before exporting
			const sortedReports = [...reportsToExport].sort((a, b) => {
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
			const selectionInfo = selectedReports.size > 0 ? `_Selected-${selectedReports.size}` : '';
			const filename = `GNI_Reports_${filterInfo}${searchInfo}${selectionInfo}_${timestamp}.xlsx`;

			// Write and download file
			XLSX.writeFile(wb, filename);
			
			const exportType = selectedReports.size > 0 ? `${selectedReports.size} selected` : 'all displayed';
			console.log(`Exported ${exportType} reports (+ totals row with Network size, Network covered, and LISA totals) to ${filename}`);
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
		// Clear selections when filters change since displayed reports might change
		clearAllSelections();
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
				totalGaps = result.stats.totalGaps || 0;
				
				// Load car distance data from API
				car1Distance = result.stats.car1Distance || 0;
				car2Distance = result.stats.car2Distance || 0;
				car3Distance = result.stats.car3Distance || 0;
				car4Distance = result.stats.car4Distance || 0;
				
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
		<div class="export-controls">
			{#if selectedReports.size > 0}
				<div class="selection-info">
					<span class="selection-count">
						{selectedReports.size} 
						{reportFilter === 'final' ? 'final' : reportFilter === 'draft' ? 'draft' : ''} 
						{selectedReports.size === 1 ? 'report' : 'reports'} selected
					</span>
					<button 
						class="button button--secondary button--small" 
						onclick={clearAllSelections}
					>
						Clear Selection
					</button>
				</div>
			{/if}
			<button 
				class="button button--primary" 
				onclick={exportToExcel}
			>
				<Download size={18} />
				{#if selectedReports.size > 0}
					Export Selected {reportFilter === 'final' ? 'Final' : reportFilter === 'draft' ? 'Draft' : ''} 
					({selectedReports.size})
				{:else}
					Export All {reportFilter === 'final' ? 'Final' : reportFilter === 'draft' ? 'Draft' : ''} 
					({displayedReports.length})
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
					<div class="stats-dashboard">
						<!-- Reports Section -->
						<div class="stats-section">
							<div class="stats-section-header">
								<h3>Reports</h3>
							</div>
							<div class="stats-section-content">
								<div class="stats-metric">
									<div class="stats-content">
										<div class="stats-value">{finalReports}</div>
										<div class="stats-label">Final Reports</div>
									</div>
								</div>
								
								<div class="stats-metric stats-metric--dimmed">
									<div class="stats-content">
										<div class="stats-value">{draftReports}</div>
										<div class="stats-label">Draft Reports</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Assets Section -->
						<div class="stats-section">
							<div class="stats-section-header">
								<h3>Assets (Final Reports)</h3>
							</div>
							<div class="stats-section-content">
								<div class="stats-metric">
									<div class="stats-content">
										<div class="stats-value">{totalCoverage().toFixed(1)}%</div>
										<div class="stats-label">Coverage</div>
									</div>
								</div>
								
								<div class="stats-metric">
									<div class="stats-content">
										<div class="stats-value">{totalLISAs}</div>
										<div class="stats-label">LISAs</div>
									</div>
								</div>
								
								<div class="stats-metric">
									<div class="stats-content">
										<div class="stats-value">{totalGaps}</div>
										<div class="stats-label">Gaps</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Vehicles Section -->
						<div class="stats-section">
							<div class="stats-section-header">
								<h3>Vehicles (Final Reports)</h3>
							</div>
							<div class="stats-section-content">
								<div class="stats-metric stats-metric--vehicle">
									<div class="stats-content">
										<div class="stats-value">{car1Distance.toFixed(1)}</div>
										<div class="stats-label">Car #1 (km)</div>
									</div>
								</div>
								
								<div class="stats-metric stats-metric--vehicle">
									<div class="stats-content">
										<div class="stats-value">{car2Distance.toFixed(1)}</div>
										<div class="stats-label">Car #2 (km)</div>
									</div>
								</div>
								
								<div class="stats-metric stats-metric--vehicle">
									<div class="stats-content">
										<div class="stats-value">{car3Distance.toFixed(1)}</div>
										<div class="stats-label">Car #3 (km)</div>
									</div>
								</div>
								
								<div class="stats-metric stats-metric--vehicle">
									<div class="stats-content">
										<div class="stats-value">{car4Distance.toFixed(1)}</div>
										<div class="stats-label">Car #4 (km)</div>
									</div>
								</div>
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
						<div class="table table--compact table--reports">
													<table class="table__element">
							<thead>
								<tr>
									<th class="table__header table__header--expand"></th>
									<th class="table__header table__header--checkbox">
										<div class="checkbox-header">
											<label class="checkbox-wrapper">
												<input 
													type="checkbox" 
													class="checkbox-input" 
													checked={allReportsSelected()}
													onchange={() => allReportsSelected() ? clearAllSelections() : selectAllReports()}
												>
												<span class="checkbox-custom"></span>
												<span class="checkbox-label" title="Select all {reportFilter === 'final' ? 'final' : reportFilter === 'draft' ? 'draft' : ''} reports">
													Select All
													{#if reportFilter !== 'all'}
														<br><span class="checkbox-label-filter">({reportFilter === 'final' ? 'Final' : 'Draft'})</span>
													{/if}
												</span>
											</label>
										</div>
									</th>
									<th class="table__header table__header--sortable table__header--report-name" role="button" tabindex="0" onclick={() => handleSort('report_name')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('report_name')}>
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
										<th class="table__header table__header--sortable table__header--report-title" role="button" tabindex="0" onclick={() => handleSort('report_title')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('report_title')}>
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
																			<th class="table__header table__header--sortable table__header--report-date" role="button" tabindex="0" onclick={() => handleSort('report_date')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('report_date')}>
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
																			<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('dist_mains_covered_length')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('dist_mains_covered_length')}>
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
									<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('dist_mains_length')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('dist_mains_length')}>
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
									<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('dist_mains_coverage')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('dist_mains_coverage')}>
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
										<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('total_duration_seconds')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('total_duration_seconds')}>
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
										<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('total_distance_km')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('total_distance_km')}>
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
										<th class="table__header table__header--sortable" role="button" tabindex="0" onclick={() => handleSort('surveyor_unit_desc')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('surveyor_unit_desc')}>
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
																			<th class="table__header table__header--sortable table__header--center" role="button" tabindex="0" onclick={() => handleSort('fieldOfViewGapsCount')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('fieldOfViewGapsCount')}>
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
									<th class="table__header table__header--sortable table__header--center" role="button" tabindex="0" onclick={() => handleSort('indicationsCount')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('indicationsCount')}>
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
									<th class="table__header table__header--sortable table__header--center" role="button" tabindex="0" onclick={() => handleSort('report_final')} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSort('report_final')}>
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
												<td class="table__cell table__cell--expand">
													<div class="skeleton-text" style="width: 14px; height: 14px; border-radius: 3px;"></div>
												</td>
												<td class="table__cell table__cell--checkbox">
													<div class="checkbox-wrapper">
														<div class="skeleton-text" style="width: 15px; height: 15px; border-radius: 3px;"></div>
													</div>
												</td>
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
											{@const hasSurveys = (report.expand?.driving_sessions?.length ?? 0) > 0}
											{@const isExpanded = expandedReports.has(report.id)}
											<tr class="table__row">
												<td class="table__cell table__cell--expand">
													{#if hasSurveys}
														<button 
															class="expand-button"
															onclick={() => toggleReportExpansion(report.id)}
															aria-expanded={isExpanded}
															aria-label="{isExpanded ? 'Collapse' : 'Expand'} surveys for {report.report_name}"
														>
															<ChevronRight 
																size={14} 
																class="expand-icon {isExpanded ? 'expand-icon--rotated' : ''}"
															/>
														</button>
													{/if}
												</td>
												<td class="table__cell table__cell--checkbox">
													<label class="checkbox-wrapper">
														<input 
															type="checkbox" 
															class="checkbox-input"
															checked={selectedReports.has(report.id)}
															onchange={() => toggleReportSelection(report.id)}
														>
														<span class="checkbox-custom"></span>
														<span class="sr-only">Select {report.report_name}</span>
													</label>
												</td>
												<td class="table__cell table__cell--report-name" title={report.report_name}>
													<div class="cell-with-copy">
														<span class="report-name-text">
															{report.report_name}
														</span>
														<button 
															class="copy-button"
															class:copy-button--success={copiedItems.has(`${report.id}-name`)}
															onclick={() => copyToClipboard(report.report_name, 'Report Name', `${report.id}-name`)}
															title={copiedItems.has(`${report.id}-name`) ? 'Copied!' : 'Copy Report Name'}
														>
															{#if copiedItems.has(`${report.id}-name`)}
																<CheckCircle size={14} />
															{:else}
																<Copy size={14} />
															{/if}
														</button>
													</div>
												</td>
												<td class="table__cell table__cell--report-title" title={report.report_title}>
													<div class="cell-with-copy">
														<span class="table__cell-content">{report.report_title}</span>
														<button 
															class="copy-button"
															class:copy-button--success={copiedItems.has(`${report.id}-title`)}
															onclick={() => copyToClipboard(report.report_title, 'Report Title', `${report.id}-title`)}
															title={copiedItems.has(`${report.id}-title`) ? 'Copied!' : 'Copy Report Title'}
														>
															{#if copiedItems.has(`${report.id}-title`)}
																<CheckCircle size={14} />
															{:else}
																<Copy size={14} />
															{/if}
														</button>
													</div>
												</td>
												<td class="table__cell table__cell--report-date">{formatDate(report.report_date)}</td>
												<td class="table__cell">{report.dist_mains_covered_length ? `${Number(report.dist_mains_covered_length).toFixed(2)} km` : 'N/A'}</td>
												<td class="table__cell">{report.dist_mains_length ? `${Number(report.dist_mains_length).toFixed(2)} km` : 'N/A'}</td>
												<td class="table__cell">
													<span class:value--high-quality={(report.dist_mains_coverage || 0) > 0.9}>
														{report.dist_mains_coverage ? `${Number(report.dist_mains_coverage * 100).toFixed(1)}%` : 'N/A'}
													</span>
												</td>
												<td class="table__cell">{report.formatted_duration || 'N/A'}</td>
												<td class="table__cell">{report.total_distance_km ? `${report.total_distance_km} km` : 'N/A'}</td>
												<td class="table__cell">{report.surveyor_unit_desc || 'N/A'}</td>
												<td class="table__cell table__cell--center">
													<span class:value--high-quality={(report.fieldOfViewGapsCount || 0) < 50}>
														{report.fieldOfViewGapsCount || 0}
													</span>
												</td>
												<td class="table__cell table__cell--center">
													<button 
														class="lisa-count-button {(report.indicationsCount || 0) > 0 ? 'lisa-count-button--active' : ''}"
														onclick={() => openLisaModal(report)}
														disabled={(report.indicationsCount || 0) === 0}
													>
														{report.indicationsCount || 0}
													</button>
												</td>
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
											{#if isExpanded && hasSurveys}
												<tr class="table__row table__row--expansion">
													<td colspan="14" class="table__cell table__cell--expansion">
														<div class="surveys-container">
															<h4 class="surveys-title">Surveys for {report.report_name}</h4>
															<div class="surveys-grid">
																{#each (report.expand?.driving_sessions || []) as session, index}
																	{@const s = session as any}
																	<div class="survey-card">
																		<div class="survey-header">
																			<span class="survey-number">
																				{s.survey_tag || `Survey #${index + 1}`}
																			</span>
																			{#if s.created}
																				<span class="survey-date">{formatDateTime(s.created)}</span>
																			{/if}
																		</div>
																		<div class="survey-details">
																			{#if s.surveyor_unit_desc}
																				<div class="survey-detail">
																					<span class="survey-label">Vehicle:</span>
																					<span class="survey-value">{s.surveyor_unit_desc}</span>
																				</div>
																			{/if}
																			{#if s.survey_start_datetime}
																				<div class="survey-detail">
																					<span class="survey-label">Start Time:</span>
																					<span class="survey-value">{formatDateTime(s.survey_start_datetime)}</span>
																				</div>
																			{/if}
																			{#if s.survey_end_datetime}
																				<div class="survey-detail">
																					<span class="survey-label">End Time:</span>
																					<span class="survey-value">{formatDateTime(s.survey_end_datetime)}</span>
																				</div>
																			{/if}
																			{#if s.stability_class}
																				<div class="survey-detail">
																					<span class="survey-label">Stability Class:</span>
																					<span class="survey-value">{s.stability_class}</span>
																				</div>
																			{/if}
																			{#if s.total_duration_seconds}
																				<div class="survey-detail">
																					<span class="survey-label">Total Duration:</span>
																					<span class="survey-value">
																						{Math.floor(Number(s.total_duration_seconds) / 3600)}h {Math.floor((Number(s.total_duration_seconds) % 3600) / 60)}m
																					</span>
																				</div>
																			{/if}
																			{#if s.total_length_meters}
																				<div class="survey-detail">
																					<span class="survey-label">Total Distance:</span>
																					<span class="survey-value">
																						{(Number(s.total_length_meters) / 1000).toFixed(1)} km
																					</span>
																				</div>
																			{/if}
																		</div>
																	</div>
																{/each}
															</div>
														</div>
													</td>
												</tr>
											{/if}
										{/each}
									{:else}
										<tr class="table__row">
											<td class="table__cell table__cell--empty" colspan="14">No reports found</td>
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

<!-- LISA Modal -->
{#if showLisaModal}
	<div class="modal-overlay" role="button" tabindex="0" onclick={closeLisaModal} onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? closeLisaModal() : null} aria-label="Close modal">
		<div class="modal-content" role="dialog" tabindex="-1" aria-labelledby="modal-title" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3 id="modal-title">LISA Indications - {selectedReportName}</h3>
				<button class="modal-close" onclick={closeLisaModal}>×</button>
			</div>
			<div class="modal-body">
				{#if selectedReportIndications.length === 0}
					<div class="no-indications">
						<AlertTriangle size={48} class="no-indications-icon" />
						<h4>No LISA Indications Found</h4>
						<p>This report does not contain any LISA indications.</p>
					</div>
				{:else}
					
					<div class="indications-list">
						{#each selectedReportIndications as indication, index}
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
	/* Stats Dashboard */
	.stats-dashboard {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.stats-section {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.stats-section-header {
		background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
		padding: 1rem 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: white;
	}

	.stats-section-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.025em;
	}

	.stats-section-content {
		padding: 1.5rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
	}

	.stats-metric {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 6px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-secondary);
		transition: all 0.2s ease;
	}

	.stats-metric:hover {
		background: var(--bg-tertiary);
		border-color: var(--border-primary);
	}

	.stats-metric--vehicle {
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.5rem;
	}

	.stats-metric--dimmed {
		opacity: 0.6;
	}

	.stats-metric--dimmed .stats-value {
		color: var(--text-secondary);
	}

	.stats-metric--dimmed .stats-label {
		color: var(--text-secondary);
		opacity: 0.7;
	}

	.stats-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: var(--bg-tertiary);
		border-radius: 6px;
		flex-shrink: 0;
		border: 1px solid var(--border-secondary);
	}

	.stats-icon--success {
		background: rgba(34, 197, 94, 0.1);
		border-color: rgba(34, 197, 94, 0.3);
		color: var(--success);
	}

	.stats-icon--warning {
		background: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.3);
		color: var(--warning);
	}

	.stats-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.stats-value {
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1;
		color: var(--text-primary);
	}

	.stats-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.stats-sublabel {
		font-size: 0.75rem;
		color: var(--accent-primary);
		opacity: 0.9;
		margin-top: 0.25rem;
		font-weight: 500;
	}

	/* Export Controls */
	.export-controls {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
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

	/* Checkbox Styles */
	.table__header--checkbox {
		width: 35px !important;
		min-width: 35px !important;
		max-width: 35px !important;
		text-align: center;
		padding: 0.5rem 0.125rem !important;
		border-right: none !important;
	}

	.table__cell--checkbox {
		width: 35px !important;
		min-width: 35px !important;
		max-width: 35px !important;
		text-align: center;
		padding: 0.5rem 0.125rem !important;
		border-right: none !important;
	}

	.checkbox-header {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		width: 100%;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		cursor: pointer;
		user-select: none;
		position: relative;
		width: 100%;
		height: 100%;
	}

	.checkbox-input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.checkbox-custom {
		width: 15px;
		height: 15px;
		border: 2px solid var(--border-primary);
		border-radius: 3px;
		background: var(--bg-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		position: relative;
		flex-shrink: 0;
	}

	.checkbox-custom::after {
		content: '';
		width: 4px;
		height: 7px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.checkbox-input:checked + .checkbox-custom {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
	}

	.checkbox-input:checked + .checkbox-custom::after {
		opacity: 1;
	}

	.checkbox-wrapper:hover .checkbox-custom {
		border-color: var(--accent-primary);
		transform: scale(1.05);
	}

	.checkbox-input:focus + .checkbox-custom {
		outline: 2px solid var(--accent-primary);
		outline-offset: 2px;
	}

	.checkbox-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
		white-space: nowrap;
		display: none; /* Hidden by default due to narrow column */
		text-align: center;
		line-height: 1.2;
	}

	.checkbox-label-filter {
		font-size: 0.65rem;
		font-weight: 400;
		color: var(--accent-primary);
		opacity: 0.8;
	}

	.checkbox-wrapper:hover .checkbox-label {
		color: var(--accent-primary);
	}

	.checkbox-input:checked + .checkbox-custom + .checkbox-label {
		color: var(--accent-primary);
	}

	/* Enhanced hover effects for table rows with checkboxes */
	.table__row:hover .checkbox-custom {
		border-color: var(--accent-primary);
		background: var(--bg-tertiary);
	}

	.table__row:hover .checkbox-input:checked + .checkbox-custom {
		background: var(--accent-primary);
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
	}

	/* Expand Column Styles */
	.table__header--expand {
		width: 25px !important;
		min-width: 25px !important;
		max-width: 25px !important;
		text-align: center;
		padding: 0.5rem 0.125rem !important;
		border-right: none !important;
	}

	.table__cell--expand {
		width: 25px !important;
		min-width: 25px !important;
		max-width: 25px !important;
		text-align: center;
		padding: 0.5rem 0.125rem !important;
		border-right: none !important;
	}

	.expand-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.125rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
		transition: background-color 0.2s ease;
		color: var(--text-secondary);
		width: 20px;
		height: 20px;
	}

	.expand-button:hover {
		background-color: var(--bg-secondary);
		color: var(--accent-primary);
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

	/* Sync Info in Page Actions */
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

	/* Copy button styles */
	.cell-with-copy {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: 0.5rem;
	}

	.copy-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		color: var(--text-secondary);
		transition: all 0.2s ease;
		opacity: 0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.copy-button:hover {
		background-color: var(--bg-secondary);
		color: var(--accent-primary);
		transform: scale(1.1);
	}

	.copy-button:active {
		transform: scale(0.95);
	}

	/* Success state styling */
	.copy-button--success {
		color: #10b981 !important; /* Green color for success */
		background-color: rgba(16, 185, 129, 0.1) !important;
		opacity: 1 !important;
		animation: copySuccess 0.3s ease-out;
	}

	.copy-button--success:hover {
		color: #059669 !important;
		background-color: rgba(16, 185, 129, 0.15) !important;
		transform: scale(1.05);
	}

	@keyframes copySuccess {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
		}
	}

	/* Show copy button on row hover */
	.table__row:hover .copy-button {
		opacity: 1;
	}

	/* Green text for high quality values */
	.value--high-quality {
		color: #15803d !important;
		font-weight: 600;
	}

	/* Adjust text containers to allow space for copy button */
	.cell-with-copy .report-name-text,
	.cell-with-copy .table__cell-content {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}



	:global(.expand-icon) {
		transition: transform 0.2s ease !important;
		color: var(--text-secondary) !important;
		transform-origin: center !important;
	}

	:global(.expand-icon--rotated) {
		transform: rotate(90deg) !important;
		color: var(--accent-primary) !important;
	}

	/* LISA Count Button */
	.lisa-count-button {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: default;
		font-size: 0.875rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.lisa-count-button--active {
		color: var(--accent-primary);
		background-color: var(--bg-secondary);
		cursor: pointer;
	}

	.lisa-count-button--active:hover {
		background-color: var(--accent-primary);
		color: white;
		transform: scale(1.05);
	}

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

	.indication-id {
		font-weight: 600;
		color: var(--text-primary);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.875rem;
		padding: 0.25rem 0.5rem;
		background: rgba(var(--accent-primary-rgb), 0.1);
		border-radius: 4px;
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

	.confidence-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.confidence-badge--high {
		background: rgba(34, 197, 94, 0.15);
		color: var(--success);
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.confidence-badge--medium {
		background: rgba(245, 158, 11, 0.15);
		color: var(--warning);
		border: 1px solid rgba(245, 158, 11, 0.3);
	}

	.confidence-badge--low {
		background: rgba(239, 68, 68, 0.15);
		color: var(--error);
		border: 1px solid rgba(239, 68, 68, 0.3);
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

	.metric-group-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 0.75rem 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
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

	.metric-card--simple {
		padding: 0.75rem;
	}

	.metric-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: rgba(var(--accent-primary-rgb), 0.1);
		color: var(--accent-primary);
		border-radius: 8px;
		flex-shrink: 0;
	}

	.metric-icon--high {
		background: rgba(239, 68, 68, 0.1);
		color: var(--error);
	}

	.metric-icon--medium {
		background: rgba(245, 158, 11, 0.1);
		color: var(--warning);
	}

	.metric-icon--low {
		background: rgba(255, 255, 255, 0.1);
		color: white;
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

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}



	/* Survey accordion styles */
	.surveys-container {
		padding: 1.5rem;
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-primary);
	}

	.surveys-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 1rem;
	}

	.surveys-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
		gap: 1rem;
	}

	.survey-card {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		padding: 1rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		overflow: hidden; /* Prevent any overflow */
		word-wrap: break-word; /* Ensure all text wraps */
	}

	.survey-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-secondary);
		gap: 0.75rem;
		min-height: 2.5rem; /* Ensure minimum height for multiple lines */
	}

	.survey-number {
		font-weight: 600;
		color: var(--accent-primary);
		font-size: 0.8rem;
		line-height: 1.2;
		word-break: break-all; /* More aggressive breaking */
		overflow-wrap: anywhere; /* Break anywhere if needed */
		hyphens: auto;
		flex: 1;
		min-width: 0; /* Allow shrinking */
		max-width: 100%; /* Ensure it doesn't exceed container */
		white-space: normal; /* Allow wrapping */
	}

	.survey-date {
		font-size: 0.75rem;
		color: var(--text-secondary);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.survey-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.survey-detail {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
	}

	.survey-label {
		color: var(--text-secondary);
		font-weight: 500;
	}

	.survey-value {
		color: var(--text-primary);
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.8rem;
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
		.stats-dashboard {
			grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
			gap: 1rem;
		}

		.stats-section-content {
			grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
			gap: 0.75rem;
			padding: 1rem;
		}

		.stats-value {
			font-size: 1.1rem;
		}
		
		.checkbox-label {
			display: none;
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
		.stats-dashboard {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.stats-section-content {
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
			padding: 0.75rem;
		}

		.stats-value {
			font-size: 1rem;
		}

		.stats-label {
			font-size: 0.75rem;
		}

		.stats-sublabel {
			font-size: 0.65rem;
		}

		.checkbox-label {
			display: none;
		}
		
		.checkbox-custom {
			width: 12px;
			height: 12px;
		}
		
		.checkbox-custom::after {
			width: 3px;
			height: 5px;
		}

		.expand-button {
			padding: 0.0625rem;
			width: 16px;
			height: 16px;
		}

		.surveys-grid {
			grid-template-columns: 1fr;
		}

		.survey-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.survey-number {
			font-size: 0.75rem;
			word-break: break-all;
			line-height: 1.1;
		}

		.surveys-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
	}



	@media (max-width: 480px) {
		.surveys-grid {
			grid-template-columns: 1fr;
		}

		.survey-card {
			padding: 0.75rem;
		}

		.survey-number {
			font-size: 0.7rem;
			line-height: 1.0;
		}

		.survey-header {
			min-height: 3rem; /* More space for long names on small screens */
		}
	}
</style>