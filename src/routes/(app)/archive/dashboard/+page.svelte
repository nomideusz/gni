<svelte:options runes={true} />

<script lang="ts">
	import '$lib/styles/tables.css';
	import '$lib/styles/dashboard.css';
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	import { formatDate, formatDateTime } from '$lib/pocketbase';
	import { IsMounted } from 'runed';
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';
	import TrendingUp from 'lucide-svelte/icons/trending-up';
	import Car from 'lucide-svelte/icons/car';
	import FileText from 'lucide-svelte/icons/file-text';
	import FileCheck from 'lucide-svelte/icons/file-check';
	import Activity from 'lucide-svelte/icons/activity';
	import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
	import Calendar from 'lucide-svelte/icons/calendar';
	import Archive from 'lucide-svelte/icons/archive';

	const { data } = $props();

	let reports = $state<any[]>([]);
	let dailyStats = $state<any[]>([]);
	let loading = $state(true);
	let statsLoading = $state(true);
	let reportsLoading = $state(true);
	let error = $state('');

	let totalReports = $state(0);
	let finalReports = $state(0);
	let draftReports = $state(0);
	let totalDistance = $state(0);
	let car1Distance = $state(0);
	let car2Distance = $state(0);
	let car3Distance = $state(0);
	let car4Distance = $state(0);
	let totalDraftDistance = $state(0);
	let car1DraftDistance = $state(0);
	let car2DraftDistance = $state(0);
	let car3DraftDistance = $state(0);
	let car4DraftDistance = $state(0);
	let totalIndications = $state(0);
	let totalGaps = $state(0);
	let car1LisaCount = $state(0);
	let car2LisaCount = $state(0);
	let car3LisaCount = $state(0);
	let car4LisaCount = $state(0);
	let totalLisaPerKm = $state(0);
	let car1LisaPerKm = $state(0);
	let car2LisaPerKm = $state(0);
	let car3LisaPerKm = $state(0);
	let car4LisaPerKm = $state(0);
	let meta = $state<any>(null);

	const isMounted = new IsMounted();

	function processDailyStats(reportsData: any[]) {
		const dateGroups = new Map<string, any[]>();
		reportsData.forEach((report: any) => {
			const rawDate = report.report_date;
			if (!rawDate) return;
			const date = new Date(rawDate).toISOString().split('T')[0];
			if (!dateGroups.has(date)) dateGroups.set(date, []);
			dateGroups.get(date)!.push(report);
		});
		
		const sortedDates = Array.from(dateGroups.keys()).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
		const stats: any[] = [];
		
		sortedDates.forEach((date) => {
			const reportsForDate = dateGroups.get(date);
			if (!reportsForDate) return;
			
			const dateObj = new Date(date);
			const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
			
			let totalDistance = 0, finalDistance = 0, draftDistance = 0;
			let finalReportsCount = 0, draftReportsCount = 0;
			let totalLisas = 0, totalGapsCount = 0;
			const vehicles = new Map();
			
			reportsForDate.forEach(report => {
				const distance = Number(report.dist_mains_covered_length || 0);
				const lisas = Number(report.indicationsCount || 0);
				const gaps = Number(report.fieldOfViewGapsCount || 0);
				const isFinal = report.report_final === true || report.report_final === 1 || report.report_final === '1';
				const vehicle = report.surveyor_unit_desc || 'Unknown';
				
				totalDistance += distance;
				if (isFinal) { finalDistance += distance; finalReportsCount++; totalLisas += lisas; totalGapsCount += gaps; }
				else { draftDistance += distance; draftReportsCount++; }
				
				if (!vehicles.has(vehicle)) vehicles.set(vehicle, { total: 0, final: 0, draft: 0 });
				const vd = vehicles.get(vehicle)!;
				vd.total += distance;
				if (isFinal) vd.final += distance; else vd.draft += distance;
			});
			
			stats.push({
				date, weekday, totalDistance, finalDistance, draftDistance,
				finalReports: finalReportsCount, draftReports: draftReportsCount,
				totalLisas, totalGaps: totalGapsCount, avgCoverage: 0,
				vehicles: sortVehiclesByCarNumber(vehicles), isWeeklySummary: false
			});
		});
		
		dailyStats = stats;
	}

	function sortVehiclesByCarNumber(vehicles: Map<string, any>) {
		return Array.from(vehicles.entries())
			.sort(([nameA], [nameB]) => {
				const carNumberA = parseInt(nameA.replace(/.*#(\d+).*/, '$1')) || 999;
				const carNumberB = parseInt(nameB.replace(/.*#(\d+).*/, '$1')) || 999;
				return carNumberA - carNumberB;
			})
			.map(([name, data]) => ({
				name: name.replace('GNI Car #', 'Car '),
				total: data.total, final: data.final, draft: data.draft
			}));
	}

	$effect(() => {
		if (data.dashboardData) {
			data.dashboardData.then((dashData: any) => {
				reports = dashData.reports || [];
				processDailyStats(dashData.reports || []);
				reportsLoading = false;

				if (dashData.stats) {
					totalReports = dashData.reports?.length || 0;
					finalReports = dashData.reports?.filter((r: any) => r.report_final === true || r.report_final === 1 || r.report_final === '1').length || 0;
					draftReports = totalReports - finalReports;
					totalDistance = dashData.stats.totalDistance || 0;
					car1Distance = dashData.stats.car1Distance || 0;
					car2Distance = dashData.stats.car2Distance || 0;
					car3Distance = dashData.stats.car3Distance || 0;
					car4Distance = dashData.stats.car4Distance || 0;
					totalDraftDistance = dashData.stats.totalDraftDistance || 0;
					car1DraftDistance = dashData.stats.car1DraftDistance || 0;
					car2DraftDistance = dashData.stats.car2DraftDistance || 0;
					car3DraftDistance = dashData.stats.car3DraftDistance || 0;
					car4DraftDistance = dashData.stats.car4DraftDistance || 0;
					totalIndications = dashData.stats.totalIndications || 0;
					totalGaps = dashData.stats.totalGaps || 0;
					car1LisaCount = dashData.stats.car1LisaCount || 0;
					car2LisaCount = dashData.stats.car2LisaCount || 0;
					car3LisaCount = dashData.stats.car3LisaCount || 0;
					car4LisaCount = dashData.stats.car4LisaCount || 0;
					totalLisaPerKm = dashData.stats.totalLisaPerKm || 0;
					car1LisaPerKm = dashData.stats.car1LisaPerKm || 0;
					car2LisaPerKm = dashData.stats.car2LisaPerKm || 0;
					car3LisaPerKm = dashData.stats.car3LisaPerKm || 0;
					car4LisaPerKm = dashData.stats.car4LisaPerKm || 0;
					statsLoading = false;
				}
				meta = dashData.meta;
				if (dashData.error) error = dashData.error;
			}).catch((err: any) => {
				error = err.message || 'Failed to load archive dashboard data';
				reportsLoading = false;
				statsLoading = false;
			});
		}
	});

	$effect(() => { loading = statsLoading || reportsLoading; });
</script>

<style>
	.archive-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1.25rem;
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.08));
		border: 1px solid rgba(245, 158, 11, 0.3);
		border-radius: 8px;
		margin-bottom: 1.5rem;
		color: var(--color-text-primary);
	}
	.archive-banner__icon { color: #d97706; flex-shrink: 0; }
	.archive-banner__text { font-size: 0.9rem; line-height: 1.4; }
	.archive-banner__title { font-weight: 600; margin-right: 0.5rem; }
	.archive-banner__link { color: var(--accent-primary); text-decoration: underline; margin-left: 0.5rem; }

	.dashboard__metrics-section { margin-bottom: 2rem; }
	.dashboard__metrics-title {
		display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;
		font-size: 1.125rem; font-weight: 600; color: var(--color-text-primary);
	}
	.dashboard__metrics--vehicles,
	.dashboard__metrics--survey,
	.dashboard__metrics--reports {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;
	}
	@media (max-width: 768px) {
		.dashboard__metrics--vehicles, .dashboard__metrics--survey, .dashboard__metrics--reports { grid-template-columns: 1fr; }
	}
</style>

<PageTemplate 
	title="Archive — Dashboard (2025)"
	subtitle="Historical data from the first project (July – December 2025)"
	fullWidth={true}
>
	{#snippet pageActions()}
		<a href="/archive/reports" class="button button--primary">
			<FileText size={18} />
			View Archive Reports
		</a>
		<a href="/" class="button button--outline">
			← Current Dashboard
		</a>
	{/snippet}

	{#snippet content()}
		<div class="dashboard">
			<div class="archive-banner">
				<div class="archive-banner__icon"><Archive size={20} /></div>
				<div class="archive-banner__text">
					<span class="archive-banner__title">Archive Mode</span>
					You are viewing historical data from the 2025 project (4 vehicles). This data is read-only.
					<a href="/" class="archive-banner__link">Switch to current project →</a>
				</div>
			</div>

			<div class="dashboard__section">
				<!-- Primary Metric -->
				<div class="dashboard__primary-metric">
					<div class="primary-metric-card {statsLoading ? 'metric-card--loading' : ''}">
						<div class="primary-metric-card__header">
							<h2 class="primary-metric-card__title">Final Distance Covered</h2>
							<p class="primary-metric-card__subtitle">2025 Project Total</p>
						</div>
						<div class="primary-metric-card__content">
							{#if statsLoading}
								<div class="skeleton-text skeleton-text--xxlarge"></div>
							{:else}
								<div class="primary-metric-card__value">
									{totalDistance.toFixed(1)}
									<span class="primary-metric-card__unit">km</span>
								</div>
								<div class="primary-metric-card__draft">
									+ {totalDraftDistance.toFixed(1)} km in draft
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Vehicle Performance (4 cars) -->
				<div class="dashboard__metrics-section">
					<h3 class="dashboard__metrics-title"><Car size={18} /> Vehicle Performance</h3>
					<div class="dashboard__metrics dashboard__metrics--vehicles">
						{#each [
							{ label: 'GNI Car #1', dist: car1Distance, draft: car1DraftDistance },
							{ label: 'GNI Car #2', dist: car2Distance, draft: car2DraftDistance },
							{ label: 'GNI Car #3', dist: car3Distance, draft: car3DraftDistance },
							{ label: 'GNI Car #4', dist: car4Distance, draft: car4DraftDistance },
						] as car}
							<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
								<div class="metric-card__icon metric-card__icon--compact"><Car size={20} /></div>
								<div class="metric-card__content">
									<span class="metric-card__label">{car.label}</span>
									<div class="metric-card__value metric-card__value--compact">
										{#if statsLoading}<div class="skeleton-text"></div>
										{:else}{car.dist.toFixed(1)} km <span class="metric-card__sub">({car.draft.toFixed(1)} draft)</span>{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Survey Findings -->
				<div class="dashboard__metrics-section">
					<h3 class="dashboard__metrics-title"><Activity size={18} /> LISAs and Gaps</h3>
					<div class="dashboard__metrics dashboard__metrics--survey">
						<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
							<div class="metric-card__icon metric-card__icon--compact metric-card__icon--success"><Activity size={20} /></div>
							<div class="metric-card__content">
								<span class="metric-card__label">LISA Indications</span>
								<div class="metric-card__value metric-card__value--compact">
									{#if statsLoading}<div class="skeleton-text"></div>
									{:else}{totalIndications} <span class="metric-card__sub">({totalLisaPerKm.toFixed(2)}/km)</span>{/if}
								</div>
							</div>
						</div>
						<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
							<div class="metric-card__icon metric-card__icon--compact metric-card__icon--warning"><AlertTriangle size={20} /></div>
							<div class="metric-card__content">
								<span class="metric-card__label">Field of View Gaps</span>
								<div class="metric-card__value metric-card__value--compact">
									{#if statsLoading}<div class="skeleton-text"></div>{:else}{totalGaps}{/if}
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Report Status -->
				<div class="dashboard__metrics-section">
					<h3 class="dashboard__metrics-title"><FileText size={18} /> Report Status</h3>
					<div class="dashboard__metrics dashboard__metrics--reports">
						<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
							<div class="metric-card__icon metric-card__icon--compact metric-card__icon--success"><FileCheck size={20} /></div>
							<div class="metric-card__content">
								<span class="metric-card__label">Final Reports</span>
								<div class="metric-card__value metric-card__value--compact">
									{#if statsLoading}<div class="skeleton-text"></div>{:else}{finalReports}{/if}
								</div>
							</div>
						</div>
						<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
							<div class="metric-card__icon metric-card__icon--compact metric-card__icon--warning"><FileText size={20} /></div>
							<div class="metric-card__content">
								<span class="metric-card__label">Draft Reports</span>
								<div class="metric-card__value metric-card__value--compact">
									{#if statsLoading}<div class="skeleton-text"></div>{:else}{draftReports}{/if}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Daily Breakdown -->
			<div class="dashboard__reports">
				<div class="dashboard__reports-header">
					<h2 class="dashboard__section-title"><Calendar size={20} /> Daily Progress Breakdown</h2>
					<a href="/archive/reports" class="dashboard__view-all">View All Archive Reports →</a>
				</div>
				<div class="dashboard__reports-content">
					{#if loading}
						<div class="loading-container">
							<div class="loading-indicator"><div class="loading-bar"></div><div class="loading-bar"></div><div class="loading-bar"></div></div>
							<p class="loading-text">Loading archive statistics...</p>
						</div>
					{:else if error}
						<div class="error-container"><p class="error">{error}</p></div>
					{:else}
						<div class="daily-stats-table">
							<table class="daily-stats-table__element">
								<thead>
									<tr>
										<th class="daily-stats-table__header">Date</th>
										<th class="daily-stats-table__header">Distance (km)</th>
										<th class="daily-stats-table__header">Final Reports</th>
										<th class="daily-stats-table__header">Draft Reports</th>
										<th class="daily-stats-table__header">LISA Count</th>
										<th class="daily-stats-table__header">Gaps</th>
										<th class="daily-stats-table__header">Vehicles</th>
									</tr>
								</thead>
								<tbody>
									{#if dailyStats.length > 0}
										{#each dailyStats as stat}
											<tr class="daily-stats-table__row">
												<td class="daily-stats-table__cell">
													<span class="daily-stats-table__date">{formatDate(stat.date)}</span>
													<span class="daily-stats-table__weekday">{stat.weekday}</span>
												</td>
												<td class="daily-stats-table__cell">
													<span class="daily-stats-table__metric">{stat.totalDistance.toFixed(1)}</span>
													{#if stat.finalDistance !== stat.totalDistance}
														<div class="daily-stats-table__breakdown">
															<span class="breakdown-final">{stat.finalDistance.toFixed(1)} final</span>
															<span class="breakdown-draft">{stat.draftDistance.toFixed(1)} draft</span>
														</div>
													{/if}
												</td>
												<td class="daily-stats-table__cell"><span class="daily-stats-table__count daily-stats-table__count--final">{stat.finalReports}</span></td>
												<td class="daily-stats-table__cell"><span class="daily-stats-table__count daily-stats-table__count--draft">{stat.draftReports}</span></td>
												<td class="daily-stats-table__cell"><span class="daily-stats-table__metric">{stat.totalLisas}</span></td>
												<td class="daily-stats-table__cell"><span class="daily-stats-table__metric">{stat.totalGaps}</span></td>
												<td class="daily-stats-table__cell">
													<div class="vehicles-list">
														{#each stat.vehicles as vehicle}
															<div class="vehicle-badge">
																<div class="vehicle-badge__header">{vehicle.name}: {vehicle.total.toFixed(1)}km</div>
																{#if vehicle.final > 0 || vehicle.draft > 0}
																	<div class="vehicle-badge__breakdown">
																		<span class="breakdown-final">{vehicle.final.toFixed(1)} final</span>
																		<span class="breakdown-draft">{vehicle.draft.toFixed(1)} draft</span>
																	</div>
																{/if}
															</div>
														{/each}
													</div>
												</td>
											</tr>
										{/each}
									{:else}
										<tr class="daily-stats-table__row">
											<td class="daily-stats-table__cell daily-stats-table__cell--empty" colspan="7">No archive data available</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/snippet}
</PageTemplate>
