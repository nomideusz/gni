<svelte:options runes={true} />

<script lang="ts">
	import '$lib/styles/tables.css';
	import '$lib/styles/dashboard.css';
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	import { authContext } from '$lib/auth';
	import { formatDate, formatDateTime } from '$lib/pocketbase';
	import type { DashboardData, Report, SyncStatus } from './+page';
	import { IsMounted } from 'runed';
	import { get } from 'svelte/store';
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';
	// Import Lucide icons
	import TrendingUp from 'lucide-svelte/icons/trending-up';
	import Car from 'lucide-svelte/icons/car';
	import Truck from 'lucide-svelte/icons/truck';
	import FileText from 'lucide-svelte/icons/file-text';
	import FileCheck from 'lucide-svelte/icons/file-check';
	import Activity from 'lucide-svelte/icons/activity';
	import Calendar from 'lucide-svelte/icons/calendar';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';

	// Recommended way to access data in SvelteKit with Svelte 5
	const { data } = $props();

	// Pre-populate with empty values to ensure immediate rendering with skeletons
	let reports = $state<Report[]>([]);
	let recentReports = $state<Report[]>([]);
	let loading = $state(true);
	let statsLoading = $state(true);
	let reportsLoading = $state(true);
	let error = $state('');
	let syncInfo = $state<SyncStatus | null>(null);

	// Statistics with default values for immediate rendering
	let totalReports = $state(0);
	let finalReports = $state(0);
	let draftReports = $state(0);
	let totalDistance = $state(0);
	let car1Distance = $state(0);
	let car2Distance = $state(0);
	let totalDraftDistance = $state(0);
	let car1DraftDistance = $state(0);
	let car2DraftDistance = $state(0);
	let totalIndications = $state(0);
	let car1LisaCount = $state(0);
	let car2LisaCount = $state(0);
	let totalLisaPerKm = $state(0);
	let car1LisaPerKm = $state(0);
	let car2LisaPerKm = $state(0);
	let meta = $state<DashboardData['meta']>(null);

	// Use IsMounted to safely access the context
	const isMounted = new IsMounted();

	// Debug logging using a function to capture current state values
	function logData() {
		console.log('Frontend received data:', {
			reports: reports.length,
			recentReports: recentReports.length,
			stats: {
				totalReports,
				finalReports,
				draftReports,
				totalDistance,
				totalDraftDistance,
				car1Distance,
				car1DraftDistance,
				car2Distance,
				car2DraftDistance
			},
			syncInfo,
			error,
			loading,
			statsLoading,
			reportsLoading
		});

		// Use try/catch to safely access context that might not be ready
		if (isMounted.current) {
			try {
				// Get the auth store from context
				const authStore = authContext.getOr(null);

				if (authStore) {
					// Get a snapshot of the current store value
					const authValue = get(authStore);
					console.log('Auth context accessed:', authValue.isAuthenticated, authValue.state);
				} else {
					console.log('Auth context not available');
				}
			} catch (err) {
				console.log('Auth context not ready yet');
			}
		}
	}

	// When component mounts
	onMount(() => {
		// Give the layout component time to initialize the context first
		setTimeout(() => {
			logData();
		}, 10);
	});

	// Process dashboardData when available
	$effect(() => {
		if (data.dashboardData) {
			// Use a promise to handle the data when it resolves
			data.dashboardData
				.then((dashData) => {
					// Set reports data
					reports = dashData.reports || [];
					recentReports = dashData.recentReports || [];
					reportsLoading = false;

					// Set stats data
					if (dashData.stats) {
						totalReports = dashData.stats.totalReports || 0;
						finalReports = dashData.stats.finalReports || 0;
						draftReports = dashData.stats.draftReports || 0;
						totalDistance = dashData.stats.totalDistance || 0;
						car1Distance = dashData.stats.car1Distance || 0;
						car2Distance = dashData.stats.car2Distance || 0;
						totalDraftDistance = dashData.stats.totalDraftDistance || 0;
						car1DraftDistance = dashData.stats.car1DraftDistance || 0;
						car2DraftDistance = dashData.stats.car2DraftDistance || 0;
						totalIndications = dashData.stats.totalIndications || 0;
						car1LisaCount = dashData.stats.car1LisaCount || 0;
						car2LisaCount = dashData.stats.car2LisaCount || 0;
						totalLisaPerKm = dashData.stats.totalLisaPerKm || 0;
						car1LisaPerKm = dashData.stats.car1LisaPerKm || 0;
						car2LisaPerKm = dashData.stats.car2LisaPerKm || 0;
						statsLoading = false;
					}

					// Set meta data
					meta = dashData.meta;

					// Set error if any
					if (dashData.error) {
						error = dashData.error;
					}

					// Log successful data processing
					console.log('Dashboard data processed:', {
						reportCount: reports.length,
						statsLoaded: !statsLoading
					});
				})
				.catch((err) => {
					// Handle any errors during promise resolution
					console.error('Error processing dashboard data:', err);
					error = err.message || 'Failed to load dashboard data';
					reportsLoading = false;
					statsLoading = false;
				});
		}
	});

	// Process syncData when available
	$effect(() => {
		if (data.syncData) {
			data.syncData
				.then((syncData) => {
					// Set sync info
					syncInfo = syncData.syncInfo;

					// Set error if any
					if (syncData.syncError) {
						error = error || syncData.syncError;
					}

					console.log('Sync data processed:', syncInfo);
				})
				.catch((err) => {
					console.error('Error processing sync data:', err);
					error = error || err.message || 'Failed to load sync data';
				});
		}
	});

	// Update overall loading state based on component loading states
	$effect(() => {
		loading = statsLoading || reportsLoading;
	});
</script>

<PageTemplate 
	title={t('dashboard.overview', $language)}
	subtitle={t('dashboard.welcomeMessage', $language)}
>
	{#snippet pageActions()}
		<a href="/reports" class="button button--primary">
			<FileText size={18} />
			{t('dashboard.viewAllReports', $language)}
		</a>
		{#if syncInfo}
			<div class="sync-info">
				<RefreshCw size={16} class="sync-info__icon" />
				<span class="sync-info__text">
					{t('dashboard.lastSynced', $language)}: {syncInfo.last_sync
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
		<div class="dashboard">
			<!-- Key Metrics Grid -->
			<div class="dashboard__metrics dashboard__metrics--primary">
				<!-- Total Distance Card -->
				<div class="metric-card metric-card--primary {statsLoading ? 'metric-card--loading' : ''}">
					<div class="metric-card__header">
						<div class="metric-card__icon metric-card__icon--primary">
							<TrendingUp size={24} />
						</div>
						<span class="metric-card__label">{t('dashboard.totalDistance', $language)}</span>
					</div>
					<div class="metric-card__value">
						{#if statsLoading}
							<div class="skeleton-text skeleton-text--large"></div>
						{:else}
							{(totalDistance + totalDraftDistance).toFixed(2)} <span class="metric-card__unit">km</span>
						{/if}
					</div>
					<div class="metric-card__footer">
						{#if statsLoading}
							<div class="skeleton-text skeleton-text--thin"></div>
						{:else}
							<div class="metric-card__stat">
								<span class="metric-card__stat-label">Final:</span>
								<span class="metric-card__stat-value">{totalDistance.toFixed(2)} km</span>
							</div>
							<div class="metric-card__stat">
								<span class="metric-card__stat-label">Draft:</span>
								<span class="metric-card__stat-value metric-card__stat-value--draft">{totalDraftDistance.toFixed(2)} km</span>
							</div>
							<div class="metric-card__stat metric-card__stat--full">
								<Activity size={14} />
								<span>{totalIndications} {t('dashboard.indications', $language)}</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Vehicle Cards -->
				<div class="metric-card {statsLoading ? 'metric-card--loading' : ''}">
					<div class="metric-card__header">
						<div class="metric-card__icon">
							<Car size={24} />
						</div>
						<span class="metric-card__label">{t('dashboard.car1Distance', $language)}</span>
					</div>
					<div class="metric-card__value">
						{#if statsLoading}
							<div class="skeleton-text skeleton-text--large"></div>
						{:else}
							{(car1Distance + car1DraftDistance).toFixed(2)} <span class="metric-card__unit">km</span>
						{/if}
					</div>
					<div class="metric-card__footer">
						{#if statsLoading}
							<div class="skeleton-text skeleton-text--thin"></div>
						{:else}
							<div class="metric-card__stat">
								<span class="metric-card__stat-label">Final:</span>
								<span class="metric-card__stat-value">{car1Distance.toFixed(2)} km</span>
							</div>
							<div class="metric-card__stat">
								<span class="metric-card__stat-label">Draft:</span>
								<span class="metric-card__stat-value metric-card__stat-value--draft">{car1DraftDistance.toFixed(2)} km</span>
							</div>
							<div class="metric-card__stat metric-card__stat--small">
								<span>{car1LisaCount} LISA</span>
							</div>
						{/if}
					</div>
				</div>

				<div class="metric-card {statsLoading ? 'metric-card--loading' : ''}">
					<div class="metric-card__header">
						<div class="metric-card__icon">
							<Car size={24} />
						</div>
						<span class="metric-card__label">{t('dashboard.car2Distance', $language)}</span>
					</div>
					<div class="metric-card__value">
						{#if statsLoading}
							<div class="skeleton-text skeleton-text--large"></div>
						{:else}
							{(car2Distance + car2DraftDistance).toFixed(2)} <span class="metric-card__unit">km</span>
						{/if}
					</div>
					<div class="metric-card__footer">
						{#if statsLoading}
							<div class="skeleton-text skeleton-text--thin"></div>
						{:else}
							<div class="metric-card__stat">
								<span class="metric-card__stat-label">Final:</span>
								<span class="metric-card__stat-value">{car2Distance.toFixed(2)} km</span>
							</div>
							<div class="metric-card__stat">
								<span class="metric-card__stat-label">Draft:</span>
								<span class="metric-card__stat-value metric-card__stat-value--draft">{car2DraftDistance.toFixed(2)} km</span>
							</div>
							<div class="metric-card__stat metric-card__stat--small">
								<span>{car2LisaCount} LISA</span>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Report Stats Row -->
			<div class="dashboard__metrics dashboard__metrics--stats">
				<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
					<div class="metric-card__icon metric-card__icon--compact">
						<FileText size={20} />
					</div>
					<div class="metric-card__content">
						<span class="metric-card__label">{t('dashboard.totalReports', $language)}</span>
						<div class="metric-card__value metric-card__value--compact">
							{#if statsLoading}
								<div class="skeleton-text"></div>
							{:else}
								{totalReports}
							{/if}
						</div>
					</div>
				</div>

				<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
					<div class="metric-card__icon metric-card__icon--compact metric-card__icon--success">
						<FileCheck size={20} />
					</div>
					<div class="metric-card__content">
						<span class="metric-card__label">{t('dashboard.finalReports', $language)}</span>
						<div class="metric-card__value metric-card__value--compact">
							{#if statsLoading}
								<div class="skeleton-text"></div>
							{:else}
								{finalReports}
							{/if}
						</div>
					</div>
				</div>

				<div class="metric-card metric-card--compact {statsLoading ? 'metric-card--loading' : ''}">
					<div class="metric-card__icon metric-card__icon--compact metric-card__icon--warning">
						<FileText size={20} />
					</div>
					<div class="metric-card__content">
						<span class="metric-card__label">{t('dashboard.draftReports', $language)}</span>
						<div class="metric-card__value metric-card__value--compact">
							{#if statsLoading}
								<div class="skeleton-text"></div>
							{:else}
								{draftReports}
							{/if}
						</div>
					</div>
				</div>
			</div>
			
			<!-- Recent Reports Section -->
			<div class="dashboard__reports">
				<div class="dashboard__reports-header">
					<h2 class="dashboard__section-title">
						<Calendar size={20} />
						{t('dashboard.recentReports', $language)}
					</h2>
					<a href="/reports" class="dashboard__view-all">
						{t('dashboard.viewAll', $language)} →
					</a>
				</div>
				
				<div class="dashboard__reports-content">
					{#if loading}
						<div class="loading-container">
							<div class="loading-indicator">
								<div class="loading-bar"></div>
								<div class="loading-bar"></div>
								<div class="loading-bar"></div>
							</div>
							<p class="loading-text">{t('dashboard.loadingReports', $language)}</p>
						</div>
					{:else if error}
						<div class="error-container">
							<p class="error">{error}</p>
						</div>
					{:else}
						<div class="reports-table">
							<table class="reports-table__element">
								<thead>
									<tr>
										<th class="reports-table__header">{t('dashboard.reportTitle', $language)}</th>
										<th class="reports-table__header">{t('dashboard.reportName', $language)}</th>
										<th class="reports-table__header">{t('dashboard.date', $language)}</th>
										<th class="reports-table__header">{t('dashboard.distance', $language)}</th>
										<th class="reports-table__header">{t('dashboard.surveyorUnit', $language)}</th>
										<th class="reports-table__header">{t('dashboard.indications', $language)}</th>
										<th class="reports-table__header reports-table__header--status">{t('dashboard.status', $language)}</th>
									</tr>
								</thead>
								<tbody>
									{#if reportsLoading}
										{#each Array(5) as _, i}
											<tr class="reports-table__row reports-table__row--loading">
												<td class="reports-table__cell reports-table__cell--primary"><div class="skeleton-text"></div></td>
												<td class="reports-table__cell"><div class="skeleton-text"></div></td>
												<td class="reports-table__cell"><div class="skeleton-text"></div></td>
												<td class="reports-table__cell"><div class="skeleton-text"></div></td>
												<td class="reports-table__cell"><div class="skeleton-text"></div></td>
												<td class="reports-table__cell"><div class="skeleton-text"></div></td>
												<td class="reports-table__cell">
													<div class="skeleton-text skeleton-text--badge"></div>
												</td>
											</tr>
										{/each}
									{:else if recentReports.length > 0}
										{#each recentReports.slice(0, 10) as report}
											<tr class="reports-table__row">
												<td class="reports-table__cell reports-table__cell--primary">
													<!-- <a href="/reports/{report.id}" class="reports-table__link"> -->
														{report.report_title}
													<!-- </a> -->
												</td>
												<td class="reports-table__cell reports-table__cell--primary">
													<!-- <a href="/reports/{report.id}" class="reports-table__link"> -->
														{report.report_name}
													<!-- </a> -->
												</td>
												<td class="reports-table__cell">
													<span class="reports-table__date">
														{formatDate(report.report_date)}
													</span>
												</td>
												<td class="reports-table__cell">
													{#if report.linear_asset_covered_length}
														<span class="reports-table__metric">
															{Number(report.linear_asset_covered_length).toFixed(2)} km
														</span>
													{:else}
														<span class="reports-table__na">—</span>
													{/if}
												</td>
												<td class="reports-table__cell">
													<span class="reports-table__unit">
														{report.surveyor_unit_desc || '—'}
													</span>
												</td>
												<td class="reports-table__cell">
													<span class="reports-table__metric">
														{report.indicationsCount || 0}
													</span>
												</td>
												<td class="reports-table__cell">
													<span class="status-badge status-badge--{report.report_final ? 'success' : 'warning'}">
														{report.report_final ? 'Final' : 'Draft'}
													</span>
												</td>
											</tr>
										{/each}
									{:else}
										<tr class="reports-table__row">
											<td class="reports-table__cell reports-table__cell--empty" colspan="6">
												{t('dashboard.noReportsFound', $language)}
											</td>
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
