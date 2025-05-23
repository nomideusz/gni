<script lang="ts">
	import { SplitPane } from '$lib';
	import { t, language } from '$lib';
	import { onMount } from 'svelte';
	
	// Define the type for project items
	type ProjectItem = {
		id: number;
		name: string;
		status: string;
		progress: number;
		owner: string;
	};
	
	// Example data for demonstration
	const exampleData = {
		metrics: [
			{ name: 'Total Users', value: 1254, change: '+12%' },
			{ name: 'Active Projects', value: 42, change: '+5%' },
			{ name: 'Completed Tasks', value: 876, change: '+18%' }
		],
		items: [
			{ id: 1, name: 'Project Alpha', status: 'active', progress: 75, owner: 'Jane Smith' },
			{ id: 2, name: 'Project Beta', status: 'pending', progress: 30, owner: 'John Doe' },
			{ id: 3, name: 'Project Gamma', status: 'completed', progress: 100, owner: 'Alice Johnson' },
			{ id: 4, name: 'Project Delta', status: 'active', progress: 60, owner: 'Bob Brown' },
			{ id: 5, name: 'Project Epsilon', status: 'paused', progress: 45, owner: 'Carol White' }
		]
	};
	
	// We'll use these to control the selected item
	let selectedItemId = $state<number | null>(null);
	let selectedItem = $state<ProjectItem | null>(null);
	
	// Handle selection
	function selectItem(id: number) {
		selectedItemId = id;
		selectedItem = exampleData.items.find(item => item.id === id) || null;
	}
	
	onMount(() => {
		// Select the first item by default when the component mounts
		if (exampleData.items.length > 0) {
			selectItem(exampleData.items[0].id);
		}
	});
</script>

<div class="page-layout">
	<div class="page-layout__container">
		<!-- Example 1: Vertical Split (similar to dashboard) -->
		<h1 class="page-header__title">{t('navigation.splitExample', $language) || 'Split Pane Examples'}</h1>
		<p class="page-header__description">This page demonstrates different ways to use the SplitPane component for layouts.</p>
		
		<!-- Vertical Split Example - 40/60 split -->
		<div class="page-section">
			<div class="page-section__header">
				<h2 class="page-section__title">Vertical Split (40% / 60%)</h2>
			</div>
			
			<div style="height: 400px;">
				<SplitPane type="vertical" min="200px" max="-200px" pos="40%" --color="#ddd">
					{#snippet a()}
						<div class="panel-container">
							<div class="page-subheader">
								<h3 class="page-subheader__title">Top Panel (40%)</h3>
							</div>
							<div class="content-wrapper">
								<div class="data-display" style="padding: 1rem;">
									<p>This panel takes 40% of the vertical space. You can drag the divider to resize.</p>
									
									<div class="dashboard-stats">
										{#each exampleData.metrics as metric}
											<div class="stat-card">
												<div class="stat-card__content">
													<h3 class="stat-card__title">{metric.name}</h3>
													<div class="stat-card__value">{metric.value}</div>
													<div class="stat-card__details">
														<span>{metric.change} from last period</span>
													</div>
												</div>
											</div>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/snippet}
					
					{#snippet b()}
						<div class="panel-container">
							<div class="page-subheader">
								<h3 class="page-subheader__title">Bottom Panel (60%)</h3>
							</div>
							<div class="content-wrapper">
								<div class="data-display">
									<div class="table">
										<table class="table__element">
											<thead>
												<tr>
													<th class="table__header">Name</th>
													<th class="table__header">Status</th>
													<th class="table__header">Progress</th>
													<th class="table__header">Owner</th>
												</tr>
											</thead>
											<tbody>
												{#each exampleData.items as item}
													<tr 
														class="table__row" 
														class:table__row--active={item.id === selectedItemId}
														onclick={() => selectItem(item.id)}
														onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? selectItem(item.id) : null}
														role="row"
														tabindex="0"
													>
														<td class="table__cell">{item.name}</td>
														<td class="table__cell">
															<span class="status status--{item.status}">{item.status}</span>
														</td>
														<td class="table__cell">{item.progress}%</td>
														<td class="table__cell">{item.owner}</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						</div>
					{/snippet}
				</SplitPane>
			</div>
		</div>
		
		<!-- Horizontal Split Example - 30/70 split -->
		<div class="page-section">
			<div class="page-section__header">
				<h2 class="page-section__title">Horizontal Split (30% / 70%)</h2>
			</div>
			
			<div style="height: 400px;">
				<SplitPane type="horizontal" min="200px" max="-200px" pos="30%" --color="#ddd">
					{#snippet a()}
						<div class="panel-container">
							<div class="page-subheader">
								<h3 class="page-subheader__title">Left Panel (30%)</h3>
							</div>
							<div class="content-wrapper">
								<div class="data-display" style="padding: 1rem;">
									<p>This is a navigation panel that takes 30% of the horizontal space.</p>
									
									<div class="list">
										{#each exampleData.items as item}
											<div 
												class="list-item" 
												class:list-item--active={item.id === selectedItemId}
												onclick={() => selectItem(item.id)}
												onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? selectItem(item.id) : null}
												role="button"
												tabindex="0"
											>
												<div class="list-item__name">{item.name}</div>
												<div class="list-item__status">
													<span class="status status--{item.status}">{item.status}</span>
												</div>
											</div>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/snippet}
					
					{#snippet b()}
						<div class="panel-container">
							<div class="page-subheader">
								<h3 class="page-subheader__title">Right Panel (70%)</h3>
								{#if selectedItem}
									<div class="page-subheader__actions">
										<button class="button button--primary">Edit {selectedItem.name}</button>
									</div>
								{/if}
							</div>
							<div class="content-wrapper">
								<div class="data-display" style="padding: 1rem;">
									{#if selectedItem}
										<div class="page-section">
											<div class="page-section__header">
												<h4 class="page-section__title">{selectedItem.name} Details</h4>
											</div>
											
											<div style="margin-top: 1rem;">
												<div class="detail-row">
													<div class="detail-label">Status:</div>
													<div class="detail-value">
														<span class="status status--{selectedItem.status}">{selectedItem.status}</span>
													</div>
												</div>
												
												<div class="detail-row">
													<div class="detail-label">Progress:</div>
													<div class="detail-value">
														<div class="progress-bar">
															<div class="progress-bar__fill" style="width: {selectedItem.progress}%"></div>
														</div>
														<span class="progress-text">{selectedItem.progress}%</span>
													</div>
												</div>
												
												<div class="detail-row">
													<div class="detail-label">Owner:</div>
													<div class="detail-value">{selectedItem.owner}</div>
												</div>
											</div>
										</div>
									{:else}
										<div class="empty-state">
											<p>Select an item from the list to view details</p>
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/snippet}
				</SplitPane>
			</div>
		</div>
		
		<!-- Nested Split Example -->
		<div class="page-section">
			<div class="page-section__header">
				<h2 class="page-section__title">Nested Split Panes</h2>
			</div>
			
			<div style="height: 500px;">
				<SplitPane type="vertical" min="200px" max="-200px" pos="50%" --color="#ddd">
					{#snippet a()}
						<!-- Top section with horizontal split -->
						<SplitPane type="horizontal" min="30%" max="70%" pos="40%" --color="#ddd">
							{#snippet a()}
								<div class="panel-container">
									<div class="page-subheader">
										<h3 class="page-subheader__title">Panel 1</h3>
									</div>
									<div class="content-wrapper">
										<div class="data-display" style="padding: 1rem;">
											<p>This is the top-left panel in a nested split layout.</p>
											<p>You can combine vertical and horizontal splits to create complex layouts.</p>
										</div>
									</div>
								</div>
							{/snippet}
							
							{#snippet b()}
								<div class="panel-container">
									<div class="page-subheader">
										<h3 class="page-subheader__title">Panel 2</h3>
									</div>
									<div class="content-wrapper">
										<div class="data-display" style="padding: 1rem;">
											<p>This is the top-right panel.</p>
											<div class="dashboard-stats">
												{#each exampleData.metrics as metric}
													<div class="stat-card">
														<div class="stat-card__content">
															<h3 class="stat-card__title">{metric.name}</h3>
															<div class="stat-card__value">{metric.value}</div>
														</div>
													</div>
												{/each}
											</div>
										</div>
									</div>
								</div>
							{/snippet}
						</SplitPane>
					{/snippet}
					
					{#snippet b()}
						<!-- Bottom section with table -->
						<div class="panel-container">
							<div class="page-subheader">
								<h3 class="page-subheader__title">Panel 3</h3>
							</div>
							<div class="content-wrapper">
								<div class="data-display">
									<div class="table">
										<table class="table__element">
											<thead>
												<tr>
													<th class="table__header">Name</th>
													<th class="table__header">Status</th>
													<th class="table__header">Progress</th>
													<th class="table__header">Owner</th>
												</tr>
											</thead>
											<tbody>
												{#each exampleData.items as item}
													<tr class="table__row">
														<td class="table__cell">{item.name}</td>
														<td class="table__cell">
															<span class="status status--{item.status}">{item.status}</span>
														</td>
														<td class="table__cell">{item.progress}%</td>
														<td class="table__cell">{item.owner}</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								</div>
							</div>
						</div>
					{/snippet}
				</SplitPane>
			</div>
		</div>
	</div>
</div>

<style>
	/* Additional styles specific to this page */
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	
	.list-item {
		padding: 0.8rem;
		border-radius: var(--radius-md);
		background-color: var(--bg-secondary);
		cursor: pointer;
		transition: background-color 0.2s ease;
		border: 1px solid var(--border-primary);
	}
	
	.list-item:hover {
		background-color: var(--bg-tertiary);
	}
	
	.list-item--active {
		background-color: rgba(37, 99, 235, 0.1);
		border-color: var(--accent-primary);
	}
	
	.list-item__name {
		font-weight: 500;
		margin-bottom: 0.4rem;
	}
	
	.empty-state {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100%;
		color: var(--text-secondary);
		font-style: italic;
	}
	
	.detail-row {
		display: flex;
		margin-bottom: 1rem;
		padding: 0.5rem;
		border-bottom: 1px solid var(--border-primary);
	}
	
	.detail-label {
		width: 100px;
		font-weight: 500;
		color: var(--text-secondary);
	}
	
	.detail-value {
		flex: 1;
	}
	
	.progress-bar {
		height: 8px;
		background-color: var(--bg-tertiary);
		border-radius: var(--radius-full);
		overflow: hidden;
		margin-bottom: 0.4rem;
	}
	
	.progress-bar__fill {
		height: 100%;
		background-color: var(--accent-primary);
	}
	
	.progress-text {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}
	
	/* Status styles for the example */
	.status--active {
		background-color: var(--success);
		color: white;
	}
	
	.status--pending {
		background-color: var(--warning);
		color: white;
	}
	
	.status--completed {
		background-color: var(--accent-primary);
		color: white;
	}
	
	.status--paused {
		background-color: var(--text-secondary);
		color: white;
	}
	
	/* Table row active state */
	.table__row--active {
		background-color: rgba(37, 99, 235, 0.1);
	}
</style> 