<script lang="ts">
	import { SplitPane } from '$lib';
	import { t, language, type Language } from '$lib';
	import { onMount } from 'svelte';
	import { gasReportsApi, type GasReport, formatDate } from '$lib/pocketbase';
	import { goto } from '$app/navigation';
	
	let gasReports: GasReport[] = [];
	let loading = true;
	let error = '';
	
	onMount(async () => {
		// Redirect to tests route
		goto('/tests');
		
		try {
			// Fetch all gas reports using our API service
			gasReports = await gasReportsApi.getAll();
		} catch (err) {
			console.error('Error fetching gas reports:', err);
			error = 'Failed to load gas reports';
		} finally {
			loading = false;
		}
	});
</script>

<div class="dashboard-layout">
	<!-- Content area with vertical SplitPane -->
	<div class="dashboard-container">
		<SplitPane type="vertical" min="200px" max="-200px" pos="60%" --color="#ddd">
			{#snippet a()}
				<!-- Main content area -->
				<div class="dashboard-content">
					<div class="dashboard-header">
						<h2>{t('dashboard.overview', $language)}</h2>
						<span>{t('dashboard.lastUpdated', $language)}: Today, 12:45 PM</span>
					</div>
					
					<div class="dashboard-grid">
						<div class="dashboard-card">
							<h3>{t('dashboard.salesPerformance', $language)}</h3>
							<div class="placeholder-chart" style="height: 150px; background: linear-gradient(120deg, #e0f7fa 0%, #80deea 100%);"></div>
							<p>{t('dashboard.salesIncrease', $language)}</p>
						</div>
						
						<div class="dashboard-card">
							<h3>{t('dashboard.userActivity', $language)}</h3>
							<div class="placeholder-chart" style="height: 150px; background: linear-gradient(120deg, #f3e5f5 0%, #ce93d8 100%);"></div>
							<p>{t('dashboard.activeUsers', $language)}</p>
						</div>
						
						<div class="dashboard-card">
							<h3>{t('dashboard.inventoryStatus', $language)}</h3>
							<div class="placeholder-chart" style="height: 150px; background: linear-gradient(120deg, #e8f5e9 0%, #a5d6a7 100%);"></div>
							<p>{t('dashboard.stockLevel', $language)}</p>
						</div>
						
						<div class="dashboard-card">
							<h3>{t('dashboard.systemHealth', $language)}</h3>
							<div class="placeholder-chart" style="height: 150px; background: linear-gradient(120deg, #fff8e1 0%, #ffe082 100%);"></div>
							<p>{t('dashboard.allOperational', $language)}</p>
						</div>
					</div>
				</div>
			{/snippet}

			{#snippet b()}
				<!-- Detail/secondary content area -->
				<div class="detail-panel">
					<div class="panel-header">
						<h2>{t('dataPanel.dataDetails', $language)}</h2>
					</div>
					
					<div class="panel-content">
						<div class="data-table">
							{#if loading}
								<p>Loading gas reports...</p>
							{:else if error}
								<p class="error">{error}</p>
							{:else}
								<table>
									<thead>
										<tr>
											<th>{t('dataPanel.id', $language)}</th>
											<th>Report Name</th>
											<th>Report Title</th>
											<th>Date</th>
											<th>Mains Covered</th>
											<th>Status</th>
										</tr>
									</thead>
									<tbody>
										{#each gasReports as report}
											<tr>
												<td>{report.id}</td>
												<td>{report.report_name}</td>
												<td>{report.report_title}</td>
												<td>{formatDate(report.report_date)}</td>
												<td>{report.dist_mains_covered}</td>
												<td>{report.report_final ? 'Final' : 'Draft'}</td>
											</tr>
										{:else}
											<tr>
												<td colspan="6">No gas reports found</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						</div>
					</div>
				</div>
			{/snippet}
		</SplitPane>
	</div>
</div>

<style>
	/* Layout */
	.dashboard-layout {
		display: flex;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}
	
	.dashboard-container {
		flex: 1;
		overflow: hidden;
	}
	
	/* Dashboard Content */
	.dashboard-content {
		background-color: #f8f9fa;
		height: 100%;
		overflow: hidden;
		padding: 1.2rem;
	}
	
	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}
	
	.dashboard-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}
	
	.dashboard-header span {
		color: #6c757d;
		font-size: 0.85rem;
	}
	
	.dashboard-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.2rem;
		overflow: hidden;
	}
	
	.dashboard-card {
		background-color: white;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
		padding: 1rem;
	}
	
	.dashboard-card h3 {
		margin-top: 0;
		margin-bottom: 1rem;
		font-size: 1.1rem;
		color: #495057;
	}
	
	.dashboard-card p {
		margin-top: 1rem;
		margin-bottom: 0;
		font-size: 0.9rem;
		color: #6c757d;
	}
	
	/* Detail Panel */
	.detail-panel {
		height: 100%;
		background-color: white;
		border-left: 1px solid #e9ecef;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	
	.panel-header {
		padding: 1rem;
		border-bottom: 1px solid #e9ecef;
	}
	
	.panel-header h2 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 500;
	}
	
	.panel-content {
		padding: 1rem;
		overflow: hidden;
		flex: 1;
	}
	
	/* Data Table */
	.data-table {
		width: 100%;
	}
	
	table {
		width: 100%;
		border-collapse: collapse;
	}
	
	th, td {
		padding: 0.8rem;
		text-align: left;
		border-bottom: 1px solid #e9ecef;
	}
	
	th {
		font-weight: 500;
		color: #495057;
		background-color: #f8f9fa;
	}
	
	tr:hover td {
		background-color: #f1f3f5;
	}
	
	.error {
		color: #dc3545;
		font-weight: 500;
	}
	
	/* Global fixes for scrollbar issues */
	:global(body), :global(html) {
		overflow: hidden;
	}
	
	:global(.pane), :global(.pane > *) {
		height: 100%;
		overflow: hidden;
	}
	
	:global(.pane > div) {
		height: 100%;
		overflow: hidden;
	}
	
	:global(::-webkit-scrollbar) {
		display: none;
	}
	
	:global(*) {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
</style>
