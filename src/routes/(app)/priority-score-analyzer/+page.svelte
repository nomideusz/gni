<svelte:options runes={true} />

<script lang="ts">
	import PageTemplate from '$lib/components/PageTemplate.svelte';
	import SectionContainer from '$lib/components/SectionContainer.svelte';

	import {
		Eye,
		Edit,
		Trash2,
		Star,
		CheckCircle,
		Clock,
		AlertTriangle,
		Sliders,
		ChevronUp,
		ChevronDown
	} from 'lucide-svelte';

	// Import page data with runes
	import type { PageProps } from './$types';
	import type { PriorityItem } from './priorityScoreUtils';
	import { calculatePS2 } from './priorityScoreUtils';

	let { data }: PageProps = $props();

	// Extract data from server response
	const priorityItems = $state<PriorityItem[]>(data.priorityScoreData?.items || []);

	// Use pre-calculated stats from +page.ts
	const { naturalGasCount, possibleNaturalGasCount, notNaturalGasCount, totalItems } =
		data.calculatedStats;

	// Filtering thresholds - use default values from priorityScoreUtils.ts
	let maxAmplitudeThreshold = $state(2); // Default threshold for maxAmplitude
	let emissionRateThresholdLow = $state(0.885); // Default second threshold for emissionRate
	let emissionRateThresholdHigh = $state(10); // Default main threshold for emissionRate
	let showFilterControls = $state(true);

	// Track if we're using default values
	let isDefaultLowThreshold = $state(true);

	// Ensure emission rate thresholds never go below 0.1 and maintain order
	$effect(() => {
		console.log(
			'$effect running - Low threshold:',
			emissionRateThresholdLow,
			'Is default:',
			isDefaultLowThreshold
		);

		// Ensure minimums
		if (emissionRateThresholdLow < 0.1) {
			emissionRateThresholdLow = 0.1;
			isDefaultLowThreshold = false;
		}
		if (emissionRateThresholdHigh < 0.1) {
			emissionRateThresholdHigh = 0.1;
		}

		// Round to avoid floating point precision issues
		// NEVER round the exact default value 0.885
		if (emissionRateThresholdLow !== 0.885) {
			emissionRateThresholdLow = Math.round(emissionRateThresholdLow * 200) / 200;
		}
		emissionRateThresholdHigh = Math.round(emissionRateThresholdHigh * 200) / 200;
	});

	// Pagination state
	let currentPage = $state(1);
	const itemsPerPage = 100;

	// Sorting state
	let sortField = $state<string | null>(null);
	let sortDirection = $state<'asc' | 'desc'>('asc');

	// Search state
	let searchQuery = $state('');

	// Filter items based on search query
	const filteredItems = $derived(() => {
		if (!searchQuery.trim()) return priorityItems;

		const query = searchQuery.toLowerCase().trim();
		return priorityItems.filter((item) => {
			// Search across multiple fields
			const searchableFields = [
				item.report_title,
				item.unique_identifier || item.id,
				item.dispositionLabel,
				item.representative_bin_label,
				item.report_date ? new Date(item.report_date).toLocaleDateString() : '',
				item.max_amplitude?.toString(),
				item.emission_rate?.toString(),
				item.representative_emission_rate?.toString(),
				item.classification_confidence?.toString(),
				item.number_of_passes?.toString(),
				item.number_of_peaks?.toString(),
				item.detection_probability?.toString(),
				item.priority_score_2?.toString(),
				calculatePS2WithThresholds(item).toString()
			];

			return searchableFields.some(field => 
				field && field.toLowerCase().includes(query)
			);
		});
	});

	// Sort items after filtering
	const sortedItems = $derived(() => {
		const itemsToSort = filteredItems();
		if (!sortField) return itemsToSort;

		return [...itemsToSort].sort((a, b) => {
			let aValue = getSortValue(a, sortField!);
			let bValue = getSortValue(b, sortField!);

			// Handle null/undefined values
			if (aValue === null || aValue === undefined) aValue = '';
			if (bValue === null || bValue === undefined) bValue = '';

			// Convert to strings for comparison if they're not numbers
			if (typeof aValue !== 'number' && typeof bValue !== 'number') {
				aValue = String(aValue).toLowerCase();
				bValue = String(bValue).toLowerCase();
			}

			let comparison = 0;
			if (aValue < bValue) comparison = -1;
			if (aValue > bValue) comparison = 1;

			return sortDirection === 'desc' ? -comparison : comparison;
		});
	});

	// Derived values for pagination (now using sorted items)
	const totalPages = $derived(Math.ceil(sortedItems().length / itemsPerPage));
	const startIndex = $derived((currentPage - 1) * itemsPerPage);
	const endIndex = $derived(Math.min(startIndex + itemsPerPage, sortedItems().length));
	const currentPageItems = $derived(sortedItems().slice(startIndex, endIndex));

	// Helper function to get sortable value from item
	function getSortValue(item: PriorityItem, field: string): any {
		switch (field) {
			case 'report_title':
				return item.report_title;
			case 'unique_identifier':
				return item.unique_identifier || item.id;
			case 'report_date':
				return item.report_date ? new Date(item.report_date).getTime() : 0;
			case 'max_amplitude':
				return item.max_amplitude;
			case 'disposition':
				return item.dispositionLabel;
			case 'classification_confidence':
				return item.classification_confidence;
			case 'number_of_passes':
				return item.number_of_passes;
			case 'number_of_peaks':
				return item.number_of_peaks;
			case 'detection_probability':
				return item.detection_probability;
			case 'emission_rate':
				return item.emission_rate;
			case 'representative_emission_rate':
				return item.representative_emission_rate;
			case 'representative_bin_label':
				return item.representative_bin_label;
			case 'priority_score_2':
				return item.priority_score_2;
			case 'calculated_ps2':
				return calculatePS2WithThresholds(item);
			default:
				return '';
		}
	}

	// Sorting function
	function handleSort(field: string) {
		if (sortField === field) {
			// Toggle direction if same field
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// New field, start with ascending
			sortField = field;
			sortDirection = 'asc';
		}
		// Reset to first page when sorting changes
		currentPage = 1;
	}

	// Stats for filtered items
	const filteredItemsCount = $derived(getFilteredItemsCount());

	function getFilteredItemsCount() {
		return priorityItems.filter(
			(item) =>
				item.isFiltered ||
				item.dispositionLabel === 'filtered' ||
				calculatePS2WithThresholds(item) < 1
		).length;
	}

	// Count items filtered with original PS2
	function getOriginalPS2FilteredCount() {
		return priorityItems.filter(
			(item) =>
				item.priority_score_2 !== undefined &&
				item.priority_score_2 !== null &&
				item.priority_score_2 < 1
		).length;
	}

	// Count items filtered with calculated PS2
	function getCalculatedPS2FilteredCount() {
		return priorityItems.filter((item) => calculatePS2WithThresholds(item) < 1).length;
	}

	// Derived values for the stats
	const originalPS2FilteredCount = $derived(getOriginalPS2FilteredCount());
	const calculatedPS2FilteredCount = $derived(getCalculatedPS2FilteredCount());

	// Calculate cumulative emission sums
	const totalEmissionSum = $derived(() => {
		return priorityItems.reduce((sum, item) => {
			return sum + (item.representative_emission_rate || 0);
		}, 0);
	});

	const originalReportedEmissionSum = $derived(() => {
		return priorityItems
			.filter((item) => !item.priority_score_2 || item.priority_score_2 >= 1)
			.reduce((sum, item) => sum + (item.representative_emission_rate || 0), 0);
	});

	const emissionReduction = $derived(() => {
		return priorityItems
			.filter((item) => calculatePS2WithThresholds(item) >= 1)
			.reduce((sum, item) => sum + (item.representative_emission_rate || 0), 0);
	});

	const emissionReductionPercent = $derived(() => {
		if (originalReportedEmissionSum() === 0) return 0;
		return (emissionReduction() / totalEmissionSum()) * 100;
	});

	// Check if an item should be filtered based on all criteria
	function shouldBeFiltered(item: PriorityItem): boolean {
		return (
			item.isFiltered ||
			item.dispositionLabel === 'filtered' ||
			calculatePS2WithThresholds(item) < 1
		);
	}

	// Custom BCH4 calculation with dynamic threshold
	function calculateCustomBCH4(maxAmplitude: number | undefined | null): number {
		if (maxAmplitude === undefined || maxAmplitude === null) return 0;

		if (maxAmplitude >= maxAmplitudeThreshold) return 1000;
		return 1;
	}

	// Custom Bemission calculation with dynamic threshold
	function calculateCustomBemission(emissionRate: number | undefined | null): number {
		if (emissionRate === undefined || emissionRate === null) return 0;

		if (emissionRate >= emissionRateThresholdHigh) return 10;
		if (emissionRate >= emissionRateThresholdLow) return 5;
		if (emissionRate >= 0.1) return 1;
		return 0.01;
	}

	// Calculate PS2 using current threshold values
	function calculatePS2WithThresholds(item: PriorityItem): number {
		// Get BCH4 value based on max_amplitude and current threshold
		const bch4 = calculateCustomBCH4(item.max_amplitude);

		// Get Bemission value based on emission_rate and current threshold
		const bemission = calculateCustomBemission(item.emission_rate);

		// Calculate square root of detection_probability (persistence)
		const detectionProbabilityRoot = item.detection_probability
			? Math.sqrt(item.detection_probability)
			: 0;

		// Get classification value (Cethane)
		const cethane = item.disposition === 1 ? 1 : item.disposition === 3 ? 0.7 : 0;

		// Calculate Priority Score 2
		const priorityScore = bch4 * bemission * detectionProbabilityRoot * cethane;

		return priorityScore;
	}

	// Find max values for setting slider ranges
	const maxAmplitudeValue = $derived(
		Math.min(
			4,
			Math.max(3, Math.max(...priorityItems.map((item) => item.max_amplitude || 0)) * 1.2)
		)
	);
	const maxEmissionRateValue = $derived(
		Math.min(
			20,
			Math.max(15, Math.max(...priorityItems.map((item) => item.emission_rate || 0)) * 1.2)
		)
	);

	// Event handlers
	function handleRefresh() {
		console.log('Refreshing data');
		// In a real app, you might want to reload the data here
		window.location.reload();
	}

	function handleFilterByScore() {
		priorityItems.sort((a, b) => calculatePS2WithThresholds(b) - calculatePS2WithThresholds(a));
		currentPage = 1; // Reset to first page after sorting
	}

	function handleDelete(id: string) {
		const index = priorityItems.findIndex((item) => item.id === id);
		if (index !== -1) {
			priorityItems.splice(index, 1);
		}
	}

	function resetThresholds() {
		maxAmplitudeThreshold = 2; // Reset to default from priorityScoreUtils
		emissionRateThresholdLow = 0.885; // Reset to exact default value
		emissionRateThresholdHigh = 10; // Reset to default from priorityScoreUtils
		isDefaultLowThreshold = true; // Mark as default again
	}

	function toggleFilterControls() {
		showFilterControls = !showFilterControls;
	}

	// Search function
	function handleSearch(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		currentPage = 1; // Reset to first page when search changes
	}

	function clearSearch() {
		searchQuery = '';
		currentPage = 1;
	}

	// Pagination functions
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
		}
	}

	function prevPage() {
		if (currentPage > 1) {
			currentPage--;
		}
	}

	// Helper function to format emission rate threshold display
	function formatLowThreshold(value: number): string {
		// Show 3 decimal places for exact default value 0.885, otherwise 2 decimal places
		if (value === 0.885) {
			return '0.885';
		}
		return value.toFixed(2);
	}

	// Debounce collision detection to prevent flickering
	let collisionTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleSliderCollision(callback: () => void) {
		if (collisionTimeout) {
			clearTimeout(collisionTimeout);
		}
		collisionTimeout = setTimeout(callback, 10);
	}
</script>

<PageTemplate title="Priority Score 2.0 Analyzer" showActions={false} fullWidth={true}>
	{#snippet content()}
		<SectionContainer
			title="LISA Filtering Analysis"
			subtitle="Based on extraction data from 13.05.2025"
			width="full"
		>
			{#snippet sectionActions()}
				<button class="button button--discrete" onclick={handleFilterByScore}>Sort by Score</button>
				<button class="button button--discrete" onclick={toggleFilterControls}>
					<Sliders size={16} class="button-icon" />
					<span>Threshold Filters</span>
				</button>
			{/snippet}

			{#snippet children()}
				{#if showFilterControls}
					<div class="filter-controls">
						<!-- Emission Impact Header -->
						<div class="impact-header">
							<div class="impact-metric impact-metric--primary">
								<div class="impact-value">
									{emissionReduction().toFixed(1)}
									<span class="impact-unit">SCFH</span>
								</div>
								<div class="impact-label">Emission Reduction</div>
							</div>
							<div class="impact-metric">
								<div class="impact-value">
									{emissionReductionPercent().toFixed(1)}%
								</div>
								<div class="impact-label">of Total Emissions</div>
							</div>
							<div class="impact-metric">
								<div class="impact-value">
									{calculatedPS2FilteredCount - originalPS2FilteredCount >= 0 ? '+' : ''}{calculatedPS2FilteredCount - originalPS2FilteredCount}
								</div>
								<div class="impact-label">LISAs Filtered</div>
							</div>
						</div>

						<div class="controls-container">
							<!-- Threshold Controls -->
							<div class="threshold-section">
								<h4 class="section-title">Thresholds</h4>
								
								<!-- CH4 Amplitude Control -->
								<div class="threshold-control">
									<div class="threshold-header">
										<label>CH4 Max Amplitude</label>
										<span class="threshold-value">≥ {maxAmplitudeThreshold.toFixed(1)}</span>
									</div>
									<div class="slider-wrapper">
										<input
											type="range"
											id="max-amplitude"
											min="0.1"
											max={maxAmplitudeValue}
											step="0.1"
											bind:value={maxAmplitudeThreshold}
											class="slider"
											oninput={(e) => {
												if (!e.target) return;
												const target = e.target as HTMLInputElement;
												const value = parseFloat(target.value);
												if (value < 0.1) {
													target.value = '0.1';
													maxAmplitudeThreshold = 0.1;
												}
											}}
										/>
										<div class="slider-scale">
											<span>0.1</span>
											<span>{maxAmplitudeValue.toFixed(1)}</span>
										</div>
									</div>
									<div class="threshold-impact">
										<div class="threshold-rule">&lt; {maxAmplitudeThreshold.toFixed(1)}: <strong>BCH4 = 1</strong></div>
										<div class="threshold-rule">≥ {maxAmplitudeThreshold.toFixed(1)}: <strong>BCH4 = 1000</strong></div>
									</div>
								</div>

								<!-- Emission Rate Control -->
								<div class="threshold-control">
									<div class="threshold-header">
										<label>Emission Rate</label>
										<span class="threshold-value">
											{formatLowThreshold(emissionRateThresholdLow)} / {emissionRateThresholdHigh.toFixed(2)}
										</span>
									</div>
									<div class="slider-wrapper">
										<div class="double-slider">
											<div class="slider-track"></div>
											<input
												type="range"
												id="emission-rate-low"
												min="0.1"
												max="12"
												step="0.005"
												bind:value={emissionRateThresholdLow}
												class="slider slider--low"
												oninput={(e) => {
													if (!e.target) return;
													const target = e.target as HTMLInputElement;
													const value = parseFloat(target.value);
													
													if (value !== 0.885) {
														isDefaultLowThreshold = false;
													}
													
													if (value < 0.1) {
														emissionRateThresholdLow = 0.1;
														isDefaultLowThreshold = false;
														return;
													}
													
													if (emissionRateThresholdHigh - value < 0.25) {
														handleSliderCollision(() => {
															emissionRateThresholdHigh = Math.min(12, value + 0.25);
														});
													}
												}}
											/>
											<input
												type="range"
												id="emission-rate-high"
												min="0.1"
												max="12"
												step="0.005"
												bind:value={emissionRateThresholdHigh}
												class="slider slider--high"
												oninput={(e) => {
													if (!e.target) return;
													const target = e.target as HTMLInputElement;
													const value = parseFloat(target.value);
													
													if (value < 0.1) {
														emissionRateThresholdHigh = 0.1;
														return;
													}
													
													if (value - emissionRateThresholdLow < 0.25) {
														handleSliderCollision(() => {
															emissionRateThresholdLow = Math.max(0.1, value - 0.25);
															isDefaultLowThreshold = false;
														});
													}
												}}
											/>
										</div>
										<div class="slider-scale">
											<span>0.1</span>
											<span>6</span>
											<span>12</span>
										</div>
									</div>
									<div class="threshold-impact">
										<div class="threshold-rule">&lt; 0.1: <strong>Bemission = 0.01</strong></div>
										<div class="threshold-rule">≥ 0.1: <strong>Bemission = 1</strong></div>
										{#if emissionRateThresholdLow >= 0.2 && emissionRateThresholdLow <= emissionRateThresholdHigh - 0.25 + 0.001}
											<div class="threshold-rule">≥ {formatLowThreshold(emissionRateThresholdLow)}: <strong>Bemission = 5</strong></div>
										{/if}
										{#if emissionRateThresholdHigh >= Math.max(0.2, emissionRateThresholdLow + 0.25 - 0.001)}
											<div class="threshold-rule">≥ {emissionRateThresholdHigh.toFixed(2)}: <strong>Bemission = 10</strong></div>
										{/if}
									</div>
								</div>

								<button class="reset-button" onclick={resetThresholds}>
									Reset to Defaults
								</button>
							</div>

							<!-- Formula & Stats -->
							<div class="formula-section">
								<h4 class="section-title">PS2 Formula</h4>
								<div class="formula-box">
									<div class="formula">
										PS2 = BCH4 × Bemission × √Persistence × Cethane
									</div>
									<div class="formula-components">
										<div class="formula-component">
											<strong>Persistence:</strong> detection probability
										</div>
										<div class="formula-component">
											<strong>Cethane:</strong> Classification factor (1 for Natural Gas, 0.7 for Possible Natural Gas, 0 otherwise)
										</div>
									</div>
									<div class="formula-note">
										Items with PS2 &lt; 1 are filtered
									</div>
								</div>

								<!-- Comparison Stats -->
								<div class="stats-grid">
									<div class="stat-box">
										<div class="stat-label">Original PS2</div>
										<div class="stat-items">
											<div class="stat-item">
												<span class="stat-number">{originalPS2FilteredCount}</span>
												<span class="stat-sublabel">filtered</span>
											</div>
											<div class="stat-item">
												<span class="stat-number stat-number--success">{totalItems - originalPS2FilteredCount}</span>
												<span class="stat-sublabel">reported</span>
											</div>
										</div>
									</div>
									
									<div class="stat-divider">→</div>
									
									<div class="stat-box stat-box--highlight">
										<div class="stat-label">Current PS2</div>
										<div class="stat-items">
											<div class="stat-item">
												<span class="stat-number">{calculatedPS2FilteredCount}</span>
												<span class="stat-sublabel">filtered</span>
											</div>
											<div class="stat-item">
												<span class="stat-number stat-number--success">{totalItems - calculatedPS2FilteredCount}</span>
												<span class="stat-sublabel">reported</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Search Input -->
				<div class="search-container">
					<div class="search-input-wrapper">
						<input
							type="text"
							placeholder="Search table entries..."
							bind:value={searchQuery}
							oninput={handleSearch}
							class="search-input"
						/>
						{#if searchQuery}
							<button
								class="search-clear-btn"
								onclick={clearSearch}
								title="Clear search"
							>
								×
							</button>
						{/if}
					</div>
					{#if searchQuery}
						<div class="search-results-info">
							Showing {sortedItems().length} of {priorityItems.length} entries
						</div>
					{/if}
				</div>

				<p class="table-scroll-hint">Scroll horizontally to view all data fields</p>
				<div class="table-container">
					<div class="table table--compact">
						<table class="table__element">
							<thead>
								<tr>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('report_title')}
									>
										<div class="sort-header">
											<span>Report Title</span>
											{#if sortField === 'report_title'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('unique_identifier')}
									>
										<div class="sort-header">
											<span>Unique ID</span>
											{#if sortField === 'unique_identifier'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('report_date')}
									>
										<div class="sort-header">
											<span>Report Date</span>
											{#if sortField === 'report_date'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('max_amplitude')}
									>
										<div class="sort-header">
											<span>CH4 Max Amplitude</span>
											{#if sortField === 'max_amplitude'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('disposition')}
									>
										<div class="sort-header">
											<span>Disposition</span>
											{#if sortField === 'disposition'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('classification_confidence')}
									>
										<div class="sort-header">
											<span>Confidence</span>
											{#if sortField === 'classification_confidence'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('number_of_passes')}
									>
										<div class="sort-header">
											<span>Number of Passes</span>
											{#if sortField === 'number_of_passes'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('number_of_peaks')}
									>
										<div class="sort-header">
											<span>Number of Peaks</span>
											{#if sortField === 'number_of_peaks'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('detection_probability')}
									>
										<div class="sort-header">
											<span>Persistence</span>
											{#if sortField === 'detection_probability'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('emission_rate')}
									>
										<div class="sort-header">
											<span>Emission Rate</span>
											{#if sortField === 'emission_rate'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('representative_emission_rate')}
									>
										<div class="sort-header">
											<span>Representative Emission Rate (SCFH)</span>
											{#if sortField === 'representative_emission_rate'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('representative_bin_label')}
									>
										<div class="sort-header">
											<span>Bin Label</span>
											{#if sortField === 'representative_bin_label'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('priority_score_2')}
									>
										<div class="sort-header">
											<span>Priority Score 2</span>
											{#if sortField === 'priority_score_2'}
												{#if sortDirection === 'asc'}
													<ChevronUp size={14} class="table__sort-icon" />
												{:else}
													<ChevronDown size={14} class="table__sort-icon" />
												{/if}
											{/if}
										</div>
									</th>
									<th
										class="table__header table__header--sortable"
										onclick={() => handleSort('calculated_ps2')}
									>
										<div class="sort-header">
											<span>Calculated PS2</span>
											{#if sortField === 'calculated_ps2'}
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
								{#each currentPageItems as item}
									<tr class={`table__row ${shouldBeFiltered(item) ? 'table__row--filtered' : ''}`}>
										<td class="table__cell">{item.report_title || ''}</td>
										<td class="table__cell">{item.unique_identifier || item.id}</td>
										<td class="table__cell"
											>{item.report_date
												? new Date(item.report_date).toLocaleDateString()
												: '-'}</td
										>
										<td class="table__cell">{item.max_amplitude?.toFixed(2) || '-'}</td>
										<td class="table__cell">{item.dispositionLabel || '-'}</td>
										<td class="table__cell">{item.classification_confidence?.toFixed(2) || '-'}</td>
										<td class="table__cell">{item.number_of_passes || '-'}</td>
										<td class="table__cell">{item.number_of_peaks || '-'}</td>
										<td class="table__cell">{item.detection_probability?.toFixed(2) || '-'}</td>
										<td class="table__cell">{item.emission_rate?.toFixed(2) || '-'}</td>
										<td class="table__cell"
											>{item.representative_emission_rate?.toFixed(2) || '-'}</td
										>
										<td class="table__cell">{item.representative_bin_label || '-'}</td>
										<td class="table__cell table__cell--score">
											<div class="score-container">
												<span class="score-value">{item.priority_score_2?.toFixed(2) || '-'}</span>
												<span class="status-indicator {item.priority_score_2 !== undefined && item.priority_score_2 !== null && item.priority_score_2 < 1 ? 'status-indicator--filtered' : 'status-indicator--active'}"></span>
											</div>
										</td>
										<td class="table__cell table__cell--score">
											<div class="score-container">
												<span class="score-value">{calculatePS2WithThresholds(item).toFixed(2)}</span>
												<span class="status-indicator {calculatePS2WithThresholds(item) < 1 ? 'status-indicator--filtered' : 'status-indicator--active'}"></span>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<!-- Pagination Controls -->
				<div class="pagination-container">
					<div class="pagination-info">
						<span class="pagination-text">
							Showing {startIndex + 1}-{endIndex} of {sortedItems().length} items
						</span>
					</div>

					<div class="pagination-controls">
						<button
							class="pagination-btn pagination-btn--prev"
							onclick={prevPage}
							disabled={currentPage === 1}
						>
							Previous
						</button>

						<div class="pagination-pages">
							{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
								const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
								return start + i;
							}) as pageNum}
								<button
									class={`pagination-btn ${pageNum === currentPage ? 'pagination-btn--active' : ''}`}
									onclick={() => goToPage(pageNum)}
								>
									{pageNum}
								</button>
							{/each}

							{#if totalPages > 5 && currentPage < totalPages - 2}
								<span class="pagination-ellipsis">...</span>
								<button class="pagination-btn" onclick={() => goToPage(totalPages)}>
									{totalPages}
								</button>
							{/if}
						</div>

						<button
							class="pagination-btn pagination-btn--next"
							onclick={nextPage}
							disabled={currentPage === totalPages}
						>
							Next
						</button>
					</div>
				</div>
			{/snippet}
		</SectionContainer>
	{/snippet}
</PageTemplate>

<style>
	/* Filter Controls - Professional Compact Design */
	.filter-controls {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		margin-bottom: 1rem;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	/* Impact Header */
	.impact-header {
		background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
		padding: 1.25rem 1.5rem;
		display: flex;
		gap: 2rem;
		align-items: center;
		color: white;
	}

	.impact-metric {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.impact-metric--primary {
		flex: 1;
		border-right: 1px solid rgba(255, 255, 255, 0.2);
		padding-right: 2rem;
	}

	.impact-value {
		font-size: 2rem;
		font-weight: 700;
		line-height: 1;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.impact-unit {
		font-size: 1rem;
		font-weight: 400;
		opacity: 0.9;
	}

	.impact-label {
		font-size: 0.85rem;
		opacity: 0.9;
	}

	/* Controls Container */
	.controls-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		background: var(--bg-secondary);
	}

	/* Threshold Section */
	.threshold-section {
		padding: 1.5rem;
		border-right: 1px solid var(--border-primary);
	}

	/* Formula Section */
	.formula-section {
		padding: 1.5rem;
		background: var(--bg-primary);
	}

	.section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin: 0 0 1rem 0;
	}

	/* Threshold Controls */
	.threshold-control {
		margin-bottom: 1.25rem;
	}

	.threshold-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.threshold-header label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.threshold-value {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent-primary);
		background: rgba(37, 99, 235, 0.1);
		padding: 0.125rem 0.5rem;
		border-radius: 12px;
	}

	/* Slider Styles */
	.slider-wrapper {
		position: relative;
		margin-bottom: 0.5rem;
	}

	.slider {
		width: 100%;
		height: 6px;
		-webkit-appearance: none;
		background: var(--border-primary);
		border-radius: 3px;
		outline: none;
		margin: 0.75rem 0;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--accent-primary);
		border: 2px solid white;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transition: transform 0.1s ease;
	}

	.slider::-webkit-slider-thumb:hover {
		transform: scale(1.1);
	}

	.slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--accent-primary);
		border: 2px solid white;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		-moz-appearance: none;
	}

	/* Double Slider */
	.double-slider {
		position: relative;
		height: 16px;
		margin: 0.75rem 0;
		display: flex;
		align-items: center;
	}

	.slider-track {
		position: absolute;
		width: 100%;
		height: 6px;
		background: var(--border-primary);
		border-radius: 3px;
		top: 50%;
		transform: translateY(-50%);
		left: 0;
	}

	.double-slider .slider {
		position: absolute;
		background: transparent;
		pointer-events: none;
		margin: 0;
		top: 0;
		height: 100%;
	}

	.double-slider .slider::-webkit-slider-thumb {
		pointer-events: auto;
	}

	.double-slider .slider::-moz-range-thumb {
		pointer-events: auto;
	}

	.slider--low::-webkit-slider-thumb {
		background: #60a5fa;
	}

	.slider--low::-moz-range-thumb {
		background: #60a5fa;
	}

	.slider-scale {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		color: var(--text-secondary);
		margin-top: 0.25rem;
	}

	.threshold-impact {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.7rem;
		color: var(--text-secondary);
		background: var(--bg-tertiary);
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		border: 1px solid var(--border-secondary);
	}

	.threshold-rule {
		white-space: nowrap;
	}

	.threshold-rule strong {
		color: var(--accent-secondary);
		font-weight: 600;
		font-family: 'Monaco', 'Menlo', monospace;
	}

	/* Reset Button */
	.reset-button {
		font-size: 0.75rem;
		padding: 0.375rem 0.75rem;
		background: transparent;
		border: 1px solid var(--border-primary);
		border-radius: 4px;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
		margin-top: 0.5rem;
	}

	.reset-button:hover {
		background: var(--bg-primary);
		color: var(--text-primary);
		border-color: var(--accent-primary);
	}

	/* Formula Box */
	.formula-box {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		padding: 1rem;
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.formula {
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--text-primary);
		font-family: 'Monaco', 'Menlo', monospace;
		margin-bottom: 0.5rem;
	}

	.formula-components {
		margin: 0.75rem 0;
		padding: 0.75rem 0;
		border-top: 1px dashed var(--border-secondary);
		border-bottom: 1px dashed var(--border-secondary);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.formula-component {
		font-size: 0.8rem;
		color: var(--text-secondary);
		text-align: left;
	}

	.formula-component strong {
		color: var(--text-primary);
		font-weight: 600;
	}

	.formula-note {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-style: italic;
	}

	/* Stats Grid */
	.stats-grid {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.stat-box {
		flex: 1;
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		padding: 0.75rem;
		text-align: center;
	}

	.stat-box--highlight {
		background: rgba(37, 99, 235, 0.05);
		border-color: var(--accent-primary);
	}

	.stat-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}

	.stat-items {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.stat-number {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1;
	}

	.stat-number--success {
		color: var(--success);
	}

	.stat-sublabel {
		font-size: 0.65rem;
		color: var(--text-secondary);
	}

	.stat-divider {
		font-size: 1.25rem;
		color: var(--accent-primary);
		font-weight: bold;
		flex-shrink: 0;
	}

	/* Responsive Design */
	@media (max-width: 1024px) {
		.impact-header {
			flex-wrap: wrap;
			gap: 1rem;
		}

		.impact-metric--primary {
			border-right: none;
			padding-right: 0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.2);
			padding-bottom: 1rem;
			width: 100%;
		}

		.controls-container {
			grid-template-columns: 1fr;
		}

		.threshold-section {
			border-right: none;
			border-bottom: 1px solid var(--border-primary);
		}
	}

	@media (max-width: 640px) {
		.impact-value {
			font-size: 1.5rem;
		}

		.stats-grid {
			flex-direction: column;
			gap: 0.75rem;
		}

		.stat-divider {
			transform: rotate(90deg);
			margin: -0.25rem 0;
		}
	}

	/* Remove all old styles that are no longer needed */
	.filter-group,
	.slider-header,
	.current-value,
	.slider-container,
	.slider-labels,
	.threshold-indicator,
	.threshold-effect,
	.controls-equation-container,
	.controls-section,
	.equation-section,
	.equation,
	.equation-formula,
	.equation-description,
	.note,
	.filter-stats,
	.filter-description,
	.button-icon,
	.button--small,
	.button--outline,
	.equation-stats,
	.equation-stats-title,
	.stats-header,
	.stat-compact,
	.stat-compact-label,
	.stat-compact-value,
	.stat-compact-value--filtered,
	.stat-compact-value--reported,
	.change-summary,
	.change-badge,
	.change-indicator-inline,
	.stats-comparison-integrated,
	.stats-column-integrated,
	.stats-arrow-integrated,
	.stats-metrics,
	.stat-group,
	.stat-group__label,
	.stat-group__values,
	.stat-compact--highlight,
	.stat-compact-value--reduction,
	.stat-compact-percent,
	.double-range-wrapper,
	.range-track-bg,
	.range-slider,
	.range-slider--low,
	.range-slider--high,
	.slider-legend,
	.legend-item,
	.legend-color {
		/* These classes are no longer used */
	}

	/* Pagination Styles */
	.pagination-container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1.5rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid var(--border-primary);
		background: var(--bg-secondary);
	}

	.pagination-info {
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	.pagination-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pagination-pages {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.pagination-btn {
		background: var(--bg-primary, white);
		border: 1px solid var(--border-primary);
		color: var(--text-primary);
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		font-size: 0.85rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.pagination-btn:hover:not(:disabled) {
		background: var(--bg-secondary, #f5f7fa);
		border-color: var(--accent-primary);
	}

	.pagination-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pagination-btn--active {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
		color: white;
	}

	.pagination-btn--active:hover {
		background: var(--accent-primary);
		border-color: var(--accent-primary);
	}

	.pagination-ellipsis {
		padding: 0.4rem 0.5rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	@media (max-width: 768px) {
		.pagination-container {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.pagination-controls {
			justify-content: center;
		}

		.pagination-info {
			text-align: center;
		}
	}

	/* Professional Table Styles - Compact Design */
	.table-container {
		background: var(--bg-primary);
		border: 1px solid var(--border-primary);
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
		margin-bottom: 1.5rem;
	}

	.table {
		width: 100%;
	}

	.table__element {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
		min-width: 1600px;
		table-layout: fixed;
	}

	.table__header {
		background: var(--bg-secondary);
		padding: 0.5rem 0.8rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		border-bottom: 1px solid var(--border-primary);
		height: 2rem;
		vertical-align: middle;
	}

	.table__row {
		border-bottom: 1px solid var(--border-secondary);
		transition: background-color 0.15s ease;
		height: 1.8rem;
	}

	.table__row:hover {
		background: var(--bg-secondary);
	}

	.table__row--filtered {
		background: rgba(239, 68, 68, 0.05);
		color: var(--text-secondary);
		opacity: 0.65;
	}

	.table__row--filtered:hover {
		background: rgba(239, 68, 68, 0.08);
	}

	.table__cell {
		padding: 0.4rem 0.8rem;
		vertical-align: middle;
		height: 1.8rem;
		box-sizing: border-box;
		border-right: 1px solid var(--border-secondary);
		font-size: 0.8rem;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.table__cell:last-child {
		border-right: none;
	}

	.table__cell--score {
		text-align: center;
		padding: 0.3rem 0.6rem;
	}

	/* Score container styling */
	.score-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		height: 100%;
	}

	.score-value {
		font-weight: 600;
		color: var(--text-primary);
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.75rem;
	}

	.status-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-indicator--active {
		background: var(--success);
		box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.2);
	}

	.status-indicator--filtered {
		background: var(--error);
		box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2);
	}

	/* Sort header styling */
	.sort-header {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		width: 100%;
		cursor: pointer;
		user-select: none;
		line-height: 1.2;
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
		margin-top: 0.05rem;
		opacity: 0.8;
	}

	.table__header--sortable:hover .table__sort-icon {
		opacity: 1;
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

	/* Button icon */
	.button-icon {
		margin-right: 0.5rem;
	}

	/* Search Styles */
	.search-container {
		margin: 1rem 0;
		padding-left: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.search-input-wrapper {
		position: relative;
		max-width: 300px;
	}

	.search-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		padding-right: 2rem;
		border: 1px solid var(--border-primary);
		border-radius: 4px;
		font-size: 0.85rem;
		background: var(--bg-primary);
		color: var(--text-primary);
		transition: all 0.2s ease;
		box-sizing: border-box;
		height: 2.25rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
	}

	.search-input::placeholder {
		color: var(--text-secondary);
		opacity: 0.7;
	}

	.search-clear-btn {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		font-size: 1rem;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0;
		width: 1.25rem;
		height: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: all 0.2s ease;
	}

	.search-clear-btn:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.search-results-info {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-style: italic;
		margin-left: 0.25rem;
	}

	@media (max-width: 640px) {
		.search-container {
			padding-left: 1rem;
		}
		
		.search-input-wrapper {
			max-width: 100%;
		}
	}
</style>
