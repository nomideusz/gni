<svelte:options runes={true} />

<script lang="ts">
	import '$lib/styles/tables.css';
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
	import Map from 'lucide-svelte/icons/map';
	import BarChart3 from 'lucide-svelte/icons/bar-chart-3';
	import Grid from 'lucide-svelte/icons/grid';

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
	let jimnyDistance = $state(0);
	let torresDistance = $state(0);
	let totalIndications = $state(0);
	let jimnyLisaCount = $state(0);
	let torresLisaCount = $state(0);
	let totalLisaPerKm = $state(0);
	let jimnyLisaPerKm = $state(0);
	let torresLisaPerKm = $state(0);
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
				draftReports
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
						jimnyDistance = dashData.stats.jimnyDistance || 0;
						torresDistance = dashData.stats.torresDistance || 0;
						totalIndications = dashData.stats.totalIndications || 0;
						jimnyLisaCount = dashData.stats.jimnyLisaCount || 0;
						torresLisaCount = dashData.stats.torresLisaCount || 0;
						totalLisaPerKm = dashData.stats.totalLisaPerKm || 0;
						jimnyLisaPerKm = dashData.stats.jimnyLisaPerKm || 0;
						torresLisaPerKm = dashData.stats.torresLisaPerKm || 0;
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

	function viewAllReports() {
		console.log('Viewing all reports');
	}
</script>

<PageTemplate 
	title={t('dashboard.overview', $language)}
>
	{#snippet pageActions()}
		<a href="/reports" class="button button--primary">{t('dashboard.viewAllReports', $language)}</a>
		{#if syncInfo}
			<div class="sync">
				{t('dashboard.lastSynced', $language)}: {syncInfo.last_sync
					? formatDateTime(syncInfo.last_sync)
					: syncInfo.last_sync_success
						? formatDateTime(syncInfo.last_sync_success)
						: 'Never'}
				<span class="sync__status sync__status--{syncInfo.sync_status || 'pending'}"
					>{syncInfo.sync_status || 'Unknown'}</span
				>
			</div>
		{/if}
	{/snippet}

	{#snippet content()}
		<SectionContainer title={t('dashboard.statistics', $language) || "Statistics"} width="wide">			
			{#snippet children()}
				<div class="dashboard-stats">
					<!-- Total Distance Card -->
					<div class="stat-card {statsLoading ? 'card--loading' : ''}">
						<div class="stat-card__icon">
							<Map size={24} />
						</div>
						<div class="stat-card__content">
							<h3 class="stat-card__title">{t('dashboard.totalDistance', $language)}</h3>
							<div class="stat-card__value">
								{#if statsLoading}
									<div class="skeleton-text"></div>
								{:else}
									{totalDistance.toFixed(2)} km
								{/if}
							</div>
							<div class="stat-card__details">
								{#if statsLoading}
									<div class="skeleton-text skeleton-text--thin"></div>
								{:else}
									<span>{t('dashboard.lisa', $language)}: {totalIndications}</span> •
									<span>{totalLisaPerKm.toFixed(2)} {t('dashboard.lisaPerKm', $language)}</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Jimny Card -->
					<div class="stat-card {statsLoading ? 'card--loading' : ''}">
						<div class="stat-card__icon">
							<BarChart3 size={24} />
						</div>
						<div class="stat-card__content">
							<h3 class="stat-card__title">{t('dashboard.jimnyDistance', $language)}</h3>
							<div class="stat-card__value">
								{#if statsLoading}
									<div class="skeleton-text"></div>
								{:else}
									{jimnyDistance.toFixed(2)} km
								{/if}
							</div>
							<div class="stat-card__details">
								{#if statsLoading}
									<div class="skeleton-text skeleton-text--thin"></div>
								{:else}
									<span>{t('dashboard.lisa', $language)}: {jimnyLisaCount}</span> •
									<span>{jimnyLisaPerKm.toFixed(2)} {t('dashboard.lisaPerKm', $language)}</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Torres Card -->
					<div class="stat-card {statsLoading ? 'card--loading' : ''}">
						<div class="stat-card__icon">
							<Grid size={24} />
						</div>
						<div class="stat-card__content">
							<h3 class="stat-card__title">{t('dashboard.torresDistance', $language)}</h3>
							<div class="stat-card__value">
								{#if statsLoading}
									<div class="skeleton-text"></div>
								{:else}
									{torresDistance.toFixed(2)} km
								{/if}
							</div>
							<div class="stat-card__details">
								{#if statsLoading}
									<div class="skeleton-text skeleton-text--thin"></div>
								{:else}
									<span>{t('dashboard.lisa', $language)}: {torresLisaCount}</span> •
									<span>{torresLisaPerKm.toFixed(2)} {t('dashboard.lisaPerKm', $language)}</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/snippet}
		</SectionContainer>
		
		<SectionContainer title={t('dashboard.recentReports', $language)} width="full">
			{#snippet sectionActions()}
				{#if !loading && !error}
					<div class="status-counts">
						{t('dashboard.final', $language)}: {finalReports} • 
						{t('dashboard.total', $language)}: {totalReports} • 
						{t('dashboard.draft', $language)}: {draftReports}
					</div>
				{/if}
			{/snippet}
			
			{#snippet children()}
				<div class="data-display">
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
						<p class="error">{error}</p>
					{:else}
						<div class="table-container">
							<div class="table">
								<table class="table__element">
									<thead>
										<tr>
											<th class="table__header">{t('dashboard.reportName', $language)}</th>
											<th class="table__header">{t('dashboard.reportTitle', $language)}</th>
											<th class="table__header">{t('dashboard.date', $language)}</th>
											<th class="table__header">{t('dashboard.assetsCovered', $language)}</th>
											<th class="table__header">{t('dashboard.surveyorUnit', $language)}</th>
											<th class="table__header">{t('dashboard.lisa', $language)}</th>
											<th class="table__header table__header--status">{t('dashboard.status', $language)}</th>
										</tr>
									</thead>
									<tbody>
										{#if reportsLoading}
											<!-- Skeleton loading rows -->
											{#each Array(3) as _, i}
												<tr class="table__row table__row--loading">
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
										{:else if recentReports.length > 0}
											{#each recentReports as report}
												<tr class="table__row {report.has_surveys &&
													(report.report_final === true ||
														report.report_final === 1 ||
														report.report_final === '1')
														? 'table__row--calculation'
														: ''}">
													<td class="table__cell">{report.report_name}</td>
													<td class="table__cell">{report.report_title}</td>
													<td class="table__cell">{formatDate(report.report_date)}</td>
													<td class="table__cell">{report.linear_asset_covered_length
														? `${Number(report.linear_asset_covered_length).toFixed(2)} km`
														: 'N/A'}</td>
													<td class="table__cell">{report.surveyor_unit_desc || 'N/A'}</td>
													<td class="table__cell">{report.indicationsCount || 0}</td>
													<td class="table__cell table__cell--status">
														<span class="badge {report.report_final === true ||
														report.report_final === 1 ||
														report.report_final === '1'
															? 'badge--green'
															: 'badge--yellow'}">
															{report.report_final === true ||
															report.report_final === 1 ||
															report.report_final === '1'
																? 'Final'
																: 'Draft'}
														</span>
													</td>
												</tr>
											{/each}
										{:else}
											<tr class="table__row">
												<td class="table__cell" colspan="7">{t('dashboard.noReportsFound', $language)}</td>
											</tr>
										{/if}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				</div>
			{/snippet}
		</SectionContainer>
	{/snippet}
	
	{#snippet footer()}
		<div class="actions">
			<a href="/reports" class="button button--primary">{t('dashboard.viewAllReports', $language)}</a>
		</div>
	{/snippet}
</PageTemplate>
