<script lang="ts">
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	import { formatDate, formatDateTime } from '$lib/pocketbase';
	import { tick } from 'svelte';
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';
	import { ChevronUp, ChevronDown, ChevronRight, Download } from 'lucide-svelte';
	import Archive from 'lucide-svelte/icons/archive';
	import LisaModal from '$lib/components/LisaModal.svelte';
	import ReportsFilters from '$lib/components/ReportsFilters.svelte';

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
		total_duration_seconds?: number;
		formatted_duration?: string;
		total_distance_km?: string;
		expand?: { driving_sessions?: any[]; indications_via_report?: any[] };
		[key: string]: any;
	}

	let finalReports = $state(0);
	let totalReports = $state(0);
	let draftReports = $state(0);
	let totalLISAs = $state(0);
	let totalGaps = $state(0);
	let car1Distance = $state(0);
	let car2Distance = $state(0);
	let car3Distance = $state(0);
	let car4Distance = $state(0);
	
	let reports = $state<Report[]>([]);
	let displayedReports = $state<Report[]>([]);
	let loading = $state(true);
	let reportsLoading = $state(true);
	let error = $state('');

	let sortColumn = $state('report_date');
	let sortDirection = $state('desc');
	let reportFilter = $state('final');
	let searchQuery = $state('');
	let includeSurveysOnly = $state(true);
	
	let expandedReports = $state<Set<string>>(new Set());
	let selectedReports = $state<Set<string>>(new Set());

	let showLisaModal = $state(false);
	let currentLisaReport = $state<any>(null);
	let copiedItems = $state(new Set());

	function toggleReportExpansion(reportId: string) {
		const newSet = new Set(expandedReports);
		if (newSet.has(reportId)) newSet.delete(reportId); else newSet.add(reportId);
		expandedReports = newSet;
	}

	function toggleReportSelection(reportId: string) {
		const newSet = new Set(selectedReports);
		if (newSet.has(reportId)) newSet.delete(reportId); else newSet.add(reportId);
		selectedReports = newSet;
	}

	function selectAllReports() { selectedReports = new Set(displayedReports.map(r => r.id)); }
	function clearAllSelections() { selectedReports = new Set(); }

	async function copyToClipboard(text: string, type: string, itemId: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedItems.add(itemId);
			copiedItems = new Set(copiedItems);
			setTimeout(() => { copiedItems.delete(itemId); copiedItems = new Set(copiedItems); }, 1500);
		} catch { /* fallback omitted for brevity */ }
	}

	const allReportsSelected = $derived(() => displayedReports.length > 0 && displayedReports.every(r => selectedReports.has(r.id)));
	const selectedReportsData = $derived(() => displayedReports.filter(r => selectedReports.has(r.id)));

	function openLisaModal(report: any) { currentLisaReport = report; showLisaModal = true; }
	function closeLisaModal() { showLisaModal = false; currentLisaReport = null; }

	function sortReports() {
		let filteredReports = [...reports];
		
		if (reportFilter === 'final') {
			filteredReports = filteredReports.filter(r => r.report_final === true || r.report_final === 1 || r.report_final === '1');
		} else if (reportFilter === 'draft') {
			filteredReports = filteredReports.filter(r => r.report_final === false || r.report_final === 0 || r.report_final === '0' || !r.report_final);
		}
		
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filteredReports = filteredReports.filter(r => 
				r.report_name?.toLowerCase().includes(query) ||
				r.report_title?.toLowerCase().includes(query) ||
				r.surveyor_unit_desc?.toLowerCase().includes(query)
			);
		}
		
		displayedReports = filteredReports.sort((a, b) => {
			let valueA: any = a[sortColumn];
			let valueB: any = b[sortColumn];
			if (sortColumn === 'report_date') { valueA = new Date(valueA).getTime(); valueB = new Date(valueB).getTime(); }
			if (['dist_mains_length', 'dist_mains_covered_length', 'dist_mains_coverage', 'indicationsCount', 'fieldOfViewGapsCount'].includes(sortColumn)) {
				valueA = Number(valueA) || 0; valueB = Number(valueB) || 0;
			}
			if (sortColumn === 'report_final') { valueA = Boolean(valueA) ? 1 : 0; valueB = Boolean(valueB) ? 1 : 0; }
			return sortDirection === 'asc' ? (valueA > valueB ? 1 : -1) : (valueA < valueB ? 1 : -1);
		});
	}

	function handleSort(column: string) {
		if (sortColumn === column) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		else { sortColumn = column; sortDirection = column === 'report_date' ? 'desc' : 'asc'; }
		sortReports();
	}

	function handleFilterChange() { if (reports.length > 0) { sortReports(); clearAllSelections(); } }
	function handleSurveyFilterChange() { loadData(); }

	const totalCoverage = $derived(() => {
		const finalOnly = reports.filter(r => r.report_final === true || r.report_final === 1 || r.report_final === '1');
		const totalAssets = finalOnly.reduce((s, r) => s + (r.dist_mains_length || 0), 0);
		const covered = finalOnly.reduce((s, r) => s + (r.dist_mains_covered_length || 0), 0);
		return totalAssets > 0 ? (covered / totalAssets) * 100 : 0;
	});

	const loadData = async () => {
		loading = true; reportsLoading = true;
		try {
			// Use archive API
			const response = await fetch(`/api/v1/archive-reports?limit=500&sort=-report_date&finalOnly=false&includeUnitDesc=true&withSurveys=${includeSurveysOnly}`);
			if (!response.ok) throw new Error(`API error: ${response.status}`);
			const result = await response.json();
			
			reports = result.reports;
			sortReports();
			
			totalReports = reports.length;
			finalReports = reports.filter(r => r.report_final === true || r.report_final === 1 || r.report_final === '1').length;
			draftReports = totalReports - finalReports;
			totalLISAs = result.stats.totalIndications || 0;
			totalGaps = result.stats.totalGaps || 0;
			car1Distance = result.stats.car1Distance || 0;
			car2Distance = result.stats.car2Distance || 0;
			car3Distance = result.stats.car3Distance || 0;
			car4Distance = result.stats.car4Distance || 0;
		} catch (err) {
			console.error('Error fetching archive reports:', err);
			error = 'Failed to load archive reports';
		} finally {
			loading = false; reportsLoading = false;
		}
	};

	onMount(() => { loadData(); });
</script>

<PageTemplate title="Archive — Reports (2025)" fullWidth={true}>
	{#snippet pageActions()}
		<a href="/archive/dashboard" class="button button--outline">Archive Dashboard</a>
		<a href="/reports" class="button button--outline">← Current Reports</a>
	{/snippet}

	{#snippet content()}
		<SectionContainer title="Archive: Survey Reports (2025)" subtitle="Historical data from the first project — 4 vehicles" width="full">
			{#snippet children()}
				<!-- Archive Banner -->
				<div class="archive-banner">
					<div class="archive-banner__icon"><Archive size={20} /></div>
					<div class="archive-banner__text">
						<span class="archive-banner__title">Archive Mode</span>
						Viewing 2025 project data (July – December). This data is read-only.
						<a href="/reports" class="archive-banner__link">Switch to current project →</a>
					</div>
				</div>

				{#if loading}
					<div class="loading-container">
						<div class="loading-indicator"><div class="loading-bar"></div><div class="loading-bar"></div><div class="loading-bar"></div></div>
						<p class="loading-text">Loading archive reports...</p>
					</div>
				{:else if error}
					<div class="error-container"><p class="error">{error}</p></div>
				{:else}
					<!-- Stats -->
					<div class="stats-dashboard">
						<div class="stats-section">
							<div class="stats-section-header"><h3>Reports</h3></div>
							<div class="stats-section-content">
								<div class="stats-metric"><div class="stats-content"><div class="stats-value">{finalReports}</div><div class="stats-label">Final Reports</div></div></div>
								<div class="stats-metric stats-metric--dimmed"><div class="stats-content"><div class="stats-value">{draftReports}</div><div class="stats-label">Draft Reports</div></div></div>
							</div>
						</div>
						<div class="stats-section">
							<div class="stats-section-header"><h3>Assets (Final Reports)</h3></div>
							<div class="stats-section-content">
								<div class="stats-metric"><div class="stats-content"><div class="stats-value">{totalCoverage().toFixed(1)}%</div><div class="stats-label">Coverage</div></div></div>
								<div class="stats-metric"><div class="stats-content"><div class="stats-value">{totalLISAs}</div><div class="stats-label">LISAs</div></div></div>
								<div class="stats-metric"><div class="stats-content"><div class="stats-value">{totalGaps}</div><div class="stats-label">Gaps</div></div></div>
							</div>
						</div>
						<div class="stats-section">
							<div class="stats-section-header"><h3>Vehicles (Final Reports)</h3></div>
							<div class="stats-section-content">
								{#each [
									{ label: 'Car #1', dist: car1Distance },
									{ label: 'Car #2', dist: car2Distance },
									{ label: 'Car #3', dist: car3Distance },
									{ label: 'Car #4', dist: car4Distance },
								] as car}
									<div class="stats-metric stats-metric--vehicle"><div class="stats-content"><div class="stats-value">{car.dist.toFixed(1)}</div><div class="stats-label">{car.label} (km)</div></div></div>
								{/each}
							</div>
						</div>
					</div>

					<!-- Filter -->
					<ReportsFilters 
						bind:reportFilter bind:searchQuery bind:includeSurveysOnly
						{finalReports} {totalReports} {draftReports} finalAndDraftReports={0}
						onFilterChange={handleFilterChange} onSurveyFilterChange={handleSurveyFilterChange}
					/>

					<!-- Table -->
					<div class="table-container">
						<div class="table table--compact table--reports">
							<table class="table__element">
								<thead>
									<tr>
										<th class="table__header table__header--expand"></th>
										<th class="table__header table__header--sortable table__header--report-date" onclick={() => handleSort('report_date')}>
											<div class="sort-header"><span>Date</span>
												{#if sortColumn === 'report_date'}{#if sortDirection === 'asc'}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable table__header--report-title" onclick={() => handleSort('report_title')}>
											<div class="sort-header"><span>Report Title</span>
												{#if sortColumn === 'report_title'}{#if sortDirection === 'asc'}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}{/if}
											</div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('dist_mains_length')}>
											<div class="sort-header"><span>Total Assets</span></div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('dist_mains_coverage')}>
											<div class="sort-header"><span>Coverage %</span></div>
										</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('dist_mains_covered_length')}>
											<div class="sort-header"><span>Assets Covered</span></div>
										</th>
										<th class="table__header table__header--sortable table__header--center" onclick={() => handleSort('fieldOfViewGapsCount')}>
											<div class="sort-header"><span>GAPS</span></div>
										</th>
										<th class="table__header table__header--sortable table__header--center" onclick={() => handleSort('indicationsCount')}>
											<div class="sort-header"><span>LISA</span></div>
										</th>
										<th class="table__header">Duration</th>
										<th class="table__header">Survey Distance</th>
										<th class="table__header table__header--sortable" onclick={() => handleSort('surveyor_unit_desc')}>
											<div class="sort-header"><span>Vehicle</span></div>
										</th>
										<th class="table__header table__header--sortable table__header--center" onclick={() => handleSort('report_final')}>
											<div class="sort-header"><span>Status</span></div>
										</th>
									</tr>
								</thead>
								<tbody>
									{#if displayedReports.length > 0}
										{#each displayedReports as report}
											{@const hasSurveys = (report.expand?.driving_sessions?.length ?? 0) > 0}
											{@const isExpanded = expandedReports.has(report.id)}
											<tr class="table__row">
												<td class="table__cell table__cell--expand">
													{#if hasSurveys}
														<button class="expand-button" onclick={() => toggleReportExpansion(report.id)} aria-expanded={isExpanded}>
															<ChevronRight size={14} class="expand-icon {isExpanded ? 'expand-icon--rotated' : ''}" />
														</button>
													{/if}
												</td>
												<td class="table__cell table__cell--report-date">{formatDateTime(report.report_date)}</td>
												<td class="table__cell table__cell--report-title" title={report.report_title}>
													<span class="table__cell-content clickable-value {copiedItems.has(`${report.id}-title`) ? 'copied-value' : ''}"
														onclick={() => copyToClipboard(report.report_title, 'Title', `${report.id}-title`)}
													>{report.report_title}</span>
												</td>
												<td class="table__cell">{report.dist_mains_length ? `${Number(report.dist_mains_length).toFixed(2)} km` : 'N/A'}</td>
												<td class="table__cell">{report.dist_mains_coverage ? `${Number(report.dist_mains_coverage * 100).toFixed(1)}%` : 'N/A'}</td>
												<td class="table__cell">{report.dist_mains_covered_length ? `${Number(report.dist_mains_covered_length).toFixed(2)} km` : 'N/A'}</td>
												<td class="table__cell table__cell--center">{report.fieldOfViewGapsCount || 0}</td>
												<td class="table__cell table__cell--center">
													<button class="lisa-count-button {(report.indicationsCount || 0) > 0 ? 'lisa-count-button--active' : ''}"
														onclick={() => openLisaModal(report)} disabled={(report.indicationsCount || 0) === 0}
													>{report.indicationsCount || 0}</button>
												</td>
												<td class="table__cell">{report.formatted_duration || 'N/A'}</td>
												<td class="table__cell">{report.total_distance_km ? `${report.total_distance_km} km` : 'N/A'}</td>
												<td class="table__cell">{report.surveyor_unit_desc || 'N/A'}</td>
												<td class="table__cell table__cell--status">
													<div class="status-container">
														<span class="status-indicator {report.report_final === true || report.report_final === 1 || report.report_final === '1' ? 'status-indicator--final' : 'status-indicator--draft'}"></span>
														<span class="status-text">{report.report_final === true || report.report_final === 1 || report.report_final === '1' ? 'Final' : 'Draft'}</span>
													</div>
												</td>
											</tr>
											{#if isExpanded && hasSurveys}
												<tr class="table__row table__row--expansion">
													<td colspan="12" class="table__cell table__cell--expansion">
														<div class="surveys-container">
															<h4 class="surveys-title">Surveys for {report.report_name}</h4>
															<div class="surveys-grid">
																{#each (report.expand?.driving_sessions || []) as session, index}
																	{@const s = session as any}
																	<div class="survey-card">
																		<div class="survey-header">
																			<span class="survey-number">{s.survey_tag || `Survey #${index + 1}`}</span>
																			{#if s.created}<span class="survey-date">{formatDateTime(s.created)}</span>{/if}
																		</div>
																		<div class="survey-details">
																			{#if s.surveyor_unit_desc}<div class="survey-detail"><span class="survey-label">Vehicle:</span><span class="survey-value">{s.surveyor_unit_desc}</span></div>{/if}
																			{#if s.survey_start_datetime}<div class="survey-detail"><span class="survey-label">Start:</span><span class="survey-value">{formatDateTime(s.survey_start_datetime)}</span></div>{/if}
																			{#if s.survey_end_datetime}<div class="survey-detail"><span class="survey-label">End:</span><span class="survey-value">{formatDateTime(s.survey_end_datetime)}</span></div>{/if}
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
										<tr class="table__row"><td class="table__cell table__cell--empty" colspan="12">No archive reports found</td></tr>
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

<LisaModal bind:show={showLisaModal} reportName={currentLisaReport?.report_name || ''} indications={currentLisaReport?.indications || []} onClose={closeLisaModal} />

<style>
	.archive-banner {
		display: flex; align-items: center; gap: 0.75rem;
		padding: 0.75rem 1.25rem;
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.08));
		border: 1px solid rgba(245, 158, 11, 0.3);
		border-radius: 8px; margin-bottom: 1.5rem; color: var(--color-text-primary);
	}
	.archive-banner__icon { color: #d97706; flex-shrink: 0; }
	.archive-banner__text { font-size: 0.9rem; line-height: 1.4; }
	.archive-banner__title { font-weight: 600; margin-right: 0.5rem; }
	.archive-banner__link { color: var(--accent-primary); text-decoration: underline; margin-left: 0.5rem; }

	.stats-dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
	.stats-section { background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: 8px; overflow: hidden; }
	.stats-section-header { background: linear-gradient(135deg, #92400e 0%, #b45309 100%); padding: 1rem 1.5rem; color: white; }
	.stats-section-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }
	.stats-section-content { padding: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; }
	.stats-metric { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 6px; background: var(--bg-secondary); border: 1px solid var(--border-secondary); }
	.stats-metric--vehicle { flex-direction: column; align-items: center; text-align: center; gap: 0.5rem; }
	.stats-metric--dimmed { opacity: 0.6; }
	.stats-content { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
	.stats-value { font-size: 1.25rem; font-weight: 700; color: var(--text-primary); }
	.stats-label { font-size: 0.8rem; color: var(--text-secondary); font-weight: 500; }

	.table-container { background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: 8px; overflow-x: auto; }
	.sort-header { display: flex; align-items: center; gap: 0.25rem; }
	.expand-button { background: none; border: none; cursor: pointer; padding: 0.125rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px; color: var(--text-secondary); }
	.expand-button:hover { background-color: var(--bg-secondary); color: var(--accent-primary); }
	:global(.expand-icon) { transition: transform 0.2s ease !important; }
	:global(.expand-icon--rotated) { transform: rotate(90deg) !important; color: var(--accent-primary) !important; }
	.clickable-value { cursor: pointer; transition: all 0.2s ease; border-radius: 4px; padding: 0.125rem 0.25rem; }
	.clickable-value:hover { background-color: var(--bg-secondary); color: var(--accent-primary); }
	.copied-value { background-color: rgba(16, 185, 129, 0.1) !important; color: #10b981 !important; }
	.lisa-count-button { background: none; border: none; color: var(--text-secondary); cursor: default; font-size: 0.875rem; padding: 0.25rem 0.5rem; border-radius: 4px; }
	.lisa-count-button--active { color: var(--accent-primary); background-color: var(--bg-secondary); cursor: pointer; }
	.lisa-count-button--active:hover { background-color: var(--accent-primary); color: white; }
	.status-container { display: flex; align-items: center; gap: 0.5rem; }
	.status-indicator { width: 8px; height: 8px; border-radius: 50%; }
	.status-indicator--final { background-color: #22c55e; }
	.status-indicator--draft { background-color: #f59e0b; }
	.surveys-container { padding: 1.5rem; background: var(--bg-secondary); }
	.surveys-title { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }
	.surveys-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 1rem; }
	.survey-card { background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: 6px; padding: 1rem; }
	.survey-header { display: flex; justify-content: space-between; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-secondary); }
	.survey-number { font-weight: 600; color: var(--accent-primary); font-size: 0.8rem; }
	.survey-date { font-size: 0.75rem; color: var(--text-secondary); }
	.survey-details { display: flex; flex-direction: column; gap: 0.5rem; }
	.survey-detail { display: flex; justify-content: space-between; font-size: 0.85rem; }
	.survey-label { color: var(--text-secondary); font-weight: 500; }
	.survey-value { color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; }
	.loading-container { display: flex; flex-direction: column; align-items: center; padding: 4rem 2rem; }
	.loading-indicator { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
	.loading-bar { width: 4px; height: 40px; background: var(--accent-primary); border-radius: 2px; animation: loading-pulse 1.2s infinite ease-in-out; }
	.loading-bar:nth-child(2) { animation-delay: 0.1s; }
	.loading-bar:nth-child(3) { animation-delay: 0.2s; }
	@keyframes loading-pulse { 0%, 80%, 100% { transform: scaleY(0.4); opacity: 0.5; } 40% { transform: scaleY(1); opacity: 1; } }
	.loading-text { color: var(--text-secondary); font-size: 0.9rem; }
	.error-container { padding: 2rem; text-align: center; }
	.error { color: var(--error); }
</style>
