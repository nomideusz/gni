<svelte:options runes={true} />

<script lang="ts">
    import PageTemplate from '$lib/components/PageTemplate.svelte';
    import SectionContainer from '$lib/components/SectionContainer.svelte';
    import { Eye, Edit, Trash2, Star, CheckCircle, Clock, AlertTriangle, Sliders, ChevronUp, ChevronDown } from 'lucide-svelte';
    
    // Import page data with runes
    import type { PageProps } from './$types';
    import type { PriorityItem } from './priorityScoreUtils';
    import { calculatePS2 } from './priorityScoreUtils';

    let { data }: PageProps = $props();
    
    // Extract data from server response
    const priorityItems = $state<PriorityItem[]>(data.priorityScoreData?.items || []);
    
    // Use pre-calculated stats from +page.ts
    const { naturalGasCount, possibleNaturalGasCount, notNaturalGasCount, totalItems } = data.calculatedStats;
    
    // Filtering thresholds - use default values from priorityScoreUtils.ts
    let maxAmplitudeThreshold = $state(2); // Default threshold for maxAmplitude
    let emissionRateThresholdLow = $state(0.885); // Default second threshold for emissionRate
    let emissionRateThresholdHigh = $state(10); // Default main threshold for emissionRate
    let showFilterControls = $state(true);
    
    // Track if we're using default values
    let isDefaultLowThreshold = $state(true);
    
    // Ensure emission rate thresholds never go below 0.1 and maintain order
    $effect(() => {
        console.log('$effect running - Low threshold:', emissionRateThresholdLow, 'Is default:', isDefaultLowThreshold);
        
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
            emissionRateThresholdLow = Math.round(emissionRateThresholdLow * 1000) / 1000;
        }
        emissionRateThresholdHigh = Math.round(emissionRateThresholdHigh * 10) / 10;
    });
    
    // Pagination state
    let currentPage = $state(1);
    const itemsPerPage = 100;
    
    // Sorting state
    let sortField = $state<string | null>(null);
    let sortDirection = $state<'asc' | 'desc'>('asc');
    
    // Sort items before pagination
    const sortedItems = $derived(() => {
        if (!sortField) return priorityItems;
        
        return [...priorityItems].sort((a, b) => {
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
            case 'report_title': return item.report_title;
            case 'unique_identifier': return item.unique_identifier || item.id;
            case 'report_date': return item.report_date ? new Date(item.report_date).getTime() : 0;
            case 'max_amplitude': return item.max_amplitude;
            case 'disposition': return item.dispositionLabel;
            case 'classification_confidence': return item.classification_confidence;
            case 'number_of_passes': return item.number_of_passes;
            case 'number_of_peaks': return item.number_of_peaks;
            case 'detection_probability': return item.detection_probability;
            case 'emission_rate': return item.emission_rate;
            case 'representative_emission_rate': return item.representative_emission_rate;
            case 'representative_bin_label': return item.representative_bin_label;
            case 'priority_score_2': return item.priority_score_2;
            case 'calculated_ps2': return calculatePS2WithThresholds(item);
            default: return '';
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
        return priorityItems.filter(item => 
            item.isFiltered || 
            item.dispositionLabel === 'filtered' || 
            calculatePS2WithThresholds(item) < 1
        ).length;
    }
    
    // Count items filtered with original PS2
    function getOriginalPS2FilteredCount() {
        return priorityItems.filter(item => 
            (item.priority_score_2 !== undefined && item.priority_score_2 !== null && item.priority_score_2 < 1)
        ).length;
    }
    
    // Count items filtered with calculated PS2
    function getCalculatedPS2FilteredCount() {
        return priorityItems.filter(item => calculatePS2WithThresholds(item) < 1).length;
    }
    
    // Derived values for the stats
    const originalPS2FilteredCount = $derived(getOriginalPS2FilteredCount());
    const calculatedPS2FilteredCount = $derived(getCalculatedPS2FilteredCount());
    
    // Check if an item should be filtered based on all criteria
    function shouldBeFiltered(item: PriorityItem): boolean {
        return item.isFiltered || 
               item.dispositionLabel === 'filtered' || 
               calculatePS2WithThresholds(item) < 1;
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
        const cethane = item.disposition === 1 ? 1 : 
                        item.disposition === 3 ? 0.7 : 0;
        
        // Calculate Priority Score 2
        const priorityScore = bch4 * bemission * detectionProbabilityRoot * cethane;
        
        return priorityScore;
    }
    
    // Find max values for setting slider ranges
    const maxAmplitudeValue = $derived(Math.min(4, Math.max(3, Math.max(...priorityItems.map(item => item.max_amplitude || 0)) * 1.2)));
    const maxEmissionRateValue = $derived(Math.min(20, Math.max(15, Math.max(...priorityItems.map(item => item.emission_rate || 0)) * 1.2)));
    
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
        const index = priorityItems.findIndex(item => item.id === id);
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
        // Show 3 decimal places for exact default value 0.885, otherwise 1 decimal place
        if (value === 0.885) {
            return "0.885";
        }
        return value.toFixed(1);
    }
</script>

<PageTemplate 
    title="Priority Score 2.0 Analyzer" 
    showActions={false}
>

    {#snippet content()}
        <SectionContainer 
            title="LISA Filtering Analysis" 
            subtitle="Based on extraction data from 13.05.2025"
            width="full">
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
                        <div class="controls-equation-container">
                            <div class="controls-section">
                                <h3>Threshold Controls</h3>
                                <div class="filter-group">
                                    <div class="slider-header">
                                        <label for="max-amplitude">CH4 Max Amplitude Threshold</label>
                                        <div class="current-value">≥ {maxAmplitudeThreshold.toFixed(1)}</div>
                                    </div>
                                    <div class="slider-container">
                                        <input 
                                            type="range" 
                                            id="max-amplitude" 
                                            min="0.1" 
                                            max={maxAmplitudeValue} 
                                            step="0.1" 
                                            bind:value={maxAmplitudeThreshold}
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
                                        <div class="slider-labels">
                                            <span>0.1</span>
                                            <span>{(maxAmplitudeValue/2).toFixed(1)}</span>
                                            <span>{maxAmplitudeValue.toFixed(1)}</span>
                                        </div>
                                        <div class="threshold-indicator">
                                            <div class="threshold-effect">
                                                <span>&lt; {maxAmplitudeThreshold.toFixed(1)}: <strong>BCH4 = 1</strong></span>
                                                <span>≥ {maxAmplitudeThreshold.toFixed(1)}: <strong>BCH4 = 1000</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="filter-group">
                                    <div class="slider-header">
                                        <label for="emission-rate">Emission Rate Threshold</label>
                                        <div class="current-value">≥ {formatLowThreshold(emissionRateThresholdLow)} - {emissionRateThresholdHigh.toFixed(1)}</div>
                                    </div>
                                    <div class="slider-container">
                                        <div class="double-range-wrapper">
                                            <div class="range-track-bg"></div>
                                            <input 
                                                type="range" 
                                                id="emission-rate-low" 
                                                min="0.1" 
                                                max={maxEmissionRateValue} 
                                                step="0.001" 
                                                bind:value={emissionRateThresholdLow}
                                                class="range-slider range-slider--low"
                                                oninput={(e) => {
                                                    if (!e.target) return;
                                                    const target = e.target as HTMLInputElement;
                                                    const value = parseFloat(target.value);
                                                    console.log('Low slider moved to:', value, 'High is at:', emissionRateThresholdHigh);
                                                    
                                                    // Mark as no longer default when user interacts
                                                    if (value !== 0.885) {
                                                        isDefaultLowThreshold = false;
                                                    }
                                                    
                                                    // Ensure minimum value
                                                    if (value < 0.1) {
                                                        emissionRateThresholdLow = 0.1;
                                                        isDefaultLowThreshold = false;
                                                        return;
                                                    }
                                                    // Ensure proper gap from high threshold (minimum 0.1 gap)
                                                    // If the gap would be less than 0.1, push the high threshold up
                                                    if (emissionRateThresholdHigh - value < 0.1) {
                                                        console.log('Pushing high slider up from', emissionRateThresholdHigh, 'to', value + 0.1);
                                                        emissionRateThresholdHigh = Math.min(maxEmissionRateValue, value + 0.1);
                                                    }
                                                }}
                                            />
                                            <input 
                                                type="range" 
                                                id="emission-rate-high" 
                                                min="0.1" 
                                                max={maxEmissionRateValue} 
                                                step="0.001" 
                                                bind:value={emissionRateThresholdHigh}
                                                class="range-slider range-slider--high"
                                                oninput={(e) => {
                                                    if (!e.target) return;
                                                    const target = e.target as HTMLInputElement;
                                                    const value = parseFloat(target.value);
                                                    console.log('High slider moved to:', value, 'Low is at:', emissionRateThresholdLow);
                                                    
                                                    // Ensure minimum value
                                                    if (value < 0.1) {
                                                        emissionRateThresholdHigh = 0.1;
                                                        return;
                                                    }
                                                    // Ensure proper gap from low threshold (minimum 0.1 gap)
                                                    // If the gap would be less than 0.1, push the low threshold down
                                                    if (value - emissionRateThresholdLow < 0.1) {
                                                        console.log('Pushing low slider down from', emissionRateThresholdLow, 'to', value - 0.1);
                                                        emissionRateThresholdLow = Math.max(0.1, value - 0.1);
                                                        isDefaultLowThreshold = false; // No longer default when pushed
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div class="slider-labels">
                                            <span>0.1</span>
                                            <span>{(maxEmissionRateValue/2).toFixed(1)}</span>
                                            <span>{maxEmissionRateValue.toFixed(1)}</span>
                                        </div>
                                        <div class="slider-legend">
                                            <div class="legend-item">
                                                <div class="legend-color" style="background: #38bdf8;"></div>
                                                <span>5x Threshold: {formatLowThreshold(emissionRateThresholdLow)}</span>
                                            </div>
                                            <div class="legend-item">
                                                <div class="legend-color" style="background: var(--accent-primary);"></div>
                                                <span>10x Threshold: {emissionRateThresholdHigh.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <div class="threshold-indicator">
                                            <div class="threshold-effect">
                                                <span>&lt; 0.1: <strong>Bemission = 0.01</strong></span>
                                                <span>≥ 0.1: <strong>Bemission = 1</strong></span>
                                                {#if emissionRateThresholdLow >= 0.2 && emissionRateThresholdLow < emissionRateThresholdHigh - 0.1}
                                                    <span>≥ {formatLowThreshold(emissionRateThresholdLow)}: <strong>Bemission = 5</strong></span>
                                                {/if}
                                                {#if emissionRateThresholdHigh >= Math.max(0.2, emissionRateThresholdLow + 0.1)}
                                                    <span>≥ {emissionRateThresholdHigh.toFixed(1)}: <strong>Bemission = 10</strong></span>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <button class="button button--small button--outline" onclick={resetThresholds}>
                                    Reset to Defaults
                                </button>
                            </div>

                            <div class="equation-section">
                                <h3>Priority Score 2 (PS2) Calculation</h3>
                                <div class="equation">
                                    <p class="equation-formula">PS2 = BCH4 × Bemission × √(Persistence) × Cethane</p>
                                </div>
                                <div class="equation-description">
                                    <p><strong>Where:</strong></p>
                                    <ul>
                                        <li><strong>BCH4</strong>: Based on CH4 max amplitude (1000 if ≥ {maxAmplitudeThreshold}, otherwise 1)</li>
                                        <li><strong>Bemission</strong>: Based on emission rate (SCFH) (
                                            {#if emissionRateThresholdHigh >= Math.max(0.2, emissionRateThresholdLow + 0.1)}10 if ≥ {emissionRateThresholdHigh.toFixed(1)}, {/if}
                                            {#if emissionRateThresholdLow >= 0.2 && emissionRateThresholdLow < emissionRateThresholdHigh - 0.1}5 if ≥ {formatLowThreshold(emissionRateThresholdLow)}, {/if}
                                            1 if ≥ 0.1, otherwise 0.01)</li>
                                        <li><strong>Persistence</strong>: Square root of detection probability</li>
                                        <li><strong>Cethane</strong>: Classification factor (1 for Natural Gas, 0.7 for Possible Natural Gas, 0 otherwise)</li>
                                    </ul>
                                    <p class="note">LISAs with PS2 score less than 1 are automatically filtered.</p>
                                </div>
                                
                                <!-- Integrated Stats Comparison -->
                                <div class="equation-stats">
                                    <div class="stats-comparison-compact">
                                        <div class="stats-column-compact">
                                            <div class="stats-header">Original PS2</div>
                                            <div class="stats-row-compact">
                                                <span class="stat-compact">
                                                    <span class="stat-compact-label">Filtered:</span>
                                                    <span class="stat-compact-value stat-compact-value--filtered">{originalPS2FilteredCount}</span>
                                                </span>
                                                <span class="stat-compact">
                                                    <span class="stat-compact-label">Reported:</span>
                                                    <span class="stat-compact-value stat-compact-value--reported">{totalItems - originalPS2FilteredCount}</span>
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div class="stats-arrow-compact">→</div>
                                        
                                        <div class="stats-column-compact">
                                            <div class="stats-header">Calculated PS2</div>
                                            <div class="stats-row-compact">
                                                <span class="stat-compact">
                                                    <span class="stat-compact-label">Filtered:</span>
                                                    <span class="stat-compact-value stat-compact-value--filtered">
                                                        {calculatedPS2FilteredCount}
                                                        {#if calculatedPS2FilteredCount !== originalPS2FilteredCount}
                                                            <span class="change-indicator-inline">
                                                                ({calculatedPS2FilteredCount > originalPS2FilteredCount ? '+' : ''}{calculatedPS2FilteredCount - originalPS2FilteredCount})
                                                            </span>
                                                        {/if}
                                                    </span>
                                                </span>
                                                <span class="stat-compact">
                                                    <span class="stat-compact-label">Reported:</span>
                                                    <span class="stat-compact-value stat-compact-value--reported">
                                                        {totalItems - calculatedPS2FilteredCount}
                                                        {#if calculatedPS2FilteredCount !== originalPS2FilteredCount}
                                                            <span class="change-indicator-inline">
                                                                ({(totalItems - calculatedPS2FilteredCount) > (totalItems - originalPS2FilteredCount) ? '+' : ''}{(totalItems - calculatedPS2FilteredCount) - (totalItems - originalPS2FilteredCount)})
                                                            </span>
                                                        {/if}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="change-summary">
                                        <span class="change-badge">
                                            {#if calculatedPS2FilteredCount !== originalPS2FilteredCount}
                                                Impact: {calculatedPS2FilteredCount > originalPS2FilteredCount ? '+' : ''}{calculatedPS2FilteredCount - originalPS2FilteredCount} filtered
                                            {:else}
                                                No impact from threshold changes
                                            {/if}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
                
                <p class="table-scroll-hint">Scroll horizontally to view all data fields</p>
                <div class="table-container">
                    <div class="table table--compact">
                        <table class="table__element">
                            <thead>
                                <tr>
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('report_title')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('unique_identifier')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('report_date')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('max_amplitude')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('disposition')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('classification_confidence')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('number_of_passes')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('number_of_peaks')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('detection_probability')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('emission_rate')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('representative_emission_rate')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('representative_bin_label')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('priority_score_2')}>
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
                                    <th class="table__header table__header--sortable" onclick={() => handleSort('calculated_ps2')}>
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
                                        <td class="table__cell">{item.report_date ? new Date(item.report_date).toLocaleDateString() : '-'}</td>
                                        <td class="table__cell">{item.max_amplitude?.toFixed(2) || '-'}</td>
                                        <td class="table__cell">{item.dispositionLabel || '-'}</td>
                                        <td class="table__cell">{item.classification_confidence?.toFixed(2) || '-'}</td>
                                        <td class="table__cell">{item.number_of_passes || '-'}</td>
                                        <td class="table__cell">{item.number_of_peaks || '-'}</td>
                                        <td class="table__cell">{item.detection_probability?.toFixed(2) || '-'}</td>
                                        <td class="table__cell">{item.emission_rate?.toFixed(2) || '-'}</td>
                                        <td class="table__cell">{item.representative_emission_rate?.toFixed(2) || '-'}</td>
                                        <td class="table__cell">{item.representative_bin_label || '-'}</td>
                                        <td class="table__cell table__cell--status">
                                            <div class="score-with-badge">
                                                <span class="score-value">{item.priority_score_2?.toFixed(2) || '-'}</span>
                                                {#if item.priority_score_2 !== undefined && item.priority_score_2 !== null && item.priority_score_2 < 1}
                                                    <span class="badge badge--red">Filtered</span>
                                                {/if}
                                            </div>
                                        </td>
                                        <td class="table__cell table__cell--status">
                                            <div class="score-with-badge">
                                                <span class="score-value">{calculatePS2WithThresholds(item).toFixed(2)}</span>
                                                {#if calculatePS2WithThresholds(item) < 1}
                                                    <span class="badge badge--red">Filtered</span>
                                            {/if}
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
                            {#each Array.from({length: Math.min(5, totalPages)}, (_, i) => {
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
                                <button 
                                    class="pagination-btn"
                                    onclick={() => goToPage(totalPages)}
                                >
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
    .filter-controls {
        background: rgba(0, 0, 0, 0.03);
        padding: 1rem;
        margin-bottom: 1.5rem;
        border-radius: 6px;
        border: 1px solid var(--border-primary);
    }
    
    .controls-equation-container {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        margin-bottom: 1rem;
    }
    
    .controls-section {
        flex: 1;
        min-width: 300px;
    }
    
    .equation-section {
        flex: 1.2;
        min-width: 300px;
        border-left: 1px dashed var(--border-secondary, #e5e7eb);
        padding-left: 1.5rem;
    }
    
    .controls-section h3,
    .equation-section h3 {
        margin-top: 0;
        margin-bottom: 1rem;
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-secondary, #4b5563);
    }
    
    .filter-group {
        margin-bottom: 1.5rem;
    }
    
    .slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    
    .slider-header label {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--text-secondary, #4b5563);
    }
    
    .current-value {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--accent-secondary);
        background: rgba(37, 99, 235, 0.2);
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
        border: 1px solid var(--accent-primary);
    }
    
    .slider-container {
        background: var(--bg-secondary, #f5f7fa);
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid var(--border-primary);
        margin: 0 0 1rem 0; /* Match the double-range-wrapper margin */
    }
    
    .slider-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 0.5rem;
        font-size: 0.75rem;
        color: var(--text-secondary);
    }
    
    .threshold-indicator {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px dashed var(--border-secondary, #e5e7eb);
    }
    
    .threshold-effect {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        font-size: 0.75rem;
    }
    
    .threshold-effect span {
        white-space: nowrap;
    }
    
    .threshold-effect strong {
        color: var(--accent-secondary);
        font-weight: 600;
    }
    
    input[type="range"] {
        width: 100%;
        height: 8px;
        -webkit-appearance: none;
        background: var(--border-primary, #d1d5db);
        border-radius: 4px;
        outline: none;
        margin: 0.5rem 0;
    }
    
    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--accent-primary);
        border: 2px solid white;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        pointer-events: auto;
        position: relative;
    }
    
    input[type="range"]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        pointer-events: auto;
        position: relative;
        -moz-appearance: none;
        background: var(--accent-primary);
    }
    
    .range-slider--low::-moz-range-thumb {
        background: #38bdf8;
    }
    
    .range-slider--high::-moz-range-thumb {
        background: var(--accent-primary);
    }
    
    .button--outline {
        background: transparent;
        border: 1px solid var(--border-primary);
        color: var(--text-primary);
    }
    
    .button--outline:hover {
        background: var(--bg-secondary, #f5f7fa);
    }
    
    .filter-stats {
        font-size: 0.85rem;
        color: var(--text-secondary);
        padding-top: 0.75rem;
        border-top: 1px solid var(--border-secondary, #e5e7eb);
    }
    
    .filter-description {
        margin-top: 0.5rem;
        font-size: 0.8rem;
        font-style: italic;
        color: var(--text-secondary);
    }
    
    .button-icon {
        margin-right: 0.5rem;
    }
    
    .button--small {
        font-size: 0.8rem;
        padding: 0.3rem 0.7rem;
        height: auto;
    }
    
    .equation {
        padding: 0.75rem 0;
        margin-bottom: 1rem;
        border-top: 1px dashed var(--border-secondary, #e5e7eb);
        border-bottom: 1px dashed var(--border-secondary, #e5e7eb);
    }
    
    .equation-formula {
        font-size: 1.1rem;
        font-weight: 500;
        text-align: center;
        margin: 0;
    }
    
    .equation-description {
        font-size: 0.85rem;
    }
    
    .equation-description ul {
        padding-left: 1.2rem;
        margin: 0.5rem 0;
    }
    
    .equation-description li {
        margin-bottom: 0.4rem;
    }
    
    .note {
        font-style: italic;
        color: var(--text-secondary);
        font-size: 0.85rem;
        margin-top: 0.75rem;
    }

    @media (max-width: 768px) {
        .equation-section {
            border-left: none;
            padding-left: 0;
            border-top: 1px dashed var(--border-secondary, #e5e7eb);
            padding-top: 1rem;
        }
    }
    
    /* Pagination Styles */
    .pagination-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1.5rem;
        padding: 1rem 0;
        border-top: 1px solid var(--border-primary);
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
    
    /* Score with badge styling */
    .score-with-badge {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
    }
    
    .score-value {
        font-weight: 500;
        color: var(--text-primary);
    }
    
    .score-with-badge .badge {
        font-size: 0.7rem;
        padding: 0.15rem 0.4rem;
        white-space: nowrap;
    }
    
    /* Sort header styling */
    .sort-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        cursor: pointer;
        user-select: none;
    }
    
    .table__header--sortable {
        cursor: pointer;
        transition: background-color 0.15s ease;
    }
    
    .table__header--sortable:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }
    
    .table__sort-icon {
        margin-left: 0.25rem;
        color: var(--accent-primary);
        flex-shrink: 0;
    }
    
    /* Integrated equation stats */
    .equation-stats {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px dashed var(--border-secondary, #e5e7eb);
    }
    
    .equation-stats-title {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 0.75rem 0;
        text-align: center;
    }
    
    .stats-comparison-compact {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.75rem;
    }
    
    .stats-column-compact {
        flex: 1;
    }
    
    .stats-header {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-secondary);
        text-align: center;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .stats-row-compact {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .stat-compact {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.25rem 0.5rem;
        background: var(--bg-tertiary, #1a1a2e);
        border-radius: 3px;
        border: 1px solid var(--border-primary);
    }
    
    .stat-compact-label {
        font-size: 0.7rem;
        color: var(--text-secondary);
    }
    
    .stat-compact-value {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text-primary);
    }
    
    .stat-compact-value--filtered {
        color: var(--error, #f87171);
    }
    
    .stat-compact-value--reported {
        color: var(--success, #16a34a);
    }
    
    .stats-arrow-compact {
        font-size: 1.2rem;
        color: var(--accent-primary);
        font-weight: bold;
        text-align: center;
        flex-shrink: 0;
    }
    
    .change-summary {
        text-align: center;
        margin-top: 0.5rem;
    }
    
    .change-badge {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--accent-secondary);
        background: rgba(96, 165, 250, 0.15);
        padding: 0.2rem 0.5rem;
        border-radius: 12px;
        border: 1px solid var(--accent-primary);
    }
    
    .change-indicator-inline {
        font-size: 0.65rem;
        color: var(--accent-secondary);
        font-weight: 500;
        margin-left: 0.25rem;
        opacity: 0.8;
    }
    
    /* Double range slider styling */
    .double-range-wrapper {
        position: relative;
        margin: 0.5rem 0; /* Match natural input margin */
        height: 20px; /* Ensure container has proper height */
    }
    
    .range-track-bg {
        position: absolute;
        width: 100%;
        height: 8px;
        background: var(--border-primary, #d1d5db);
        border-radius: 4px;
        border: none;
        top: 50%; /* Center vertically in container */
        transform: translateY(-50%); /* Perfect centering */
        z-index: 1 !important; /* Track below sliders */
    }
    
    .range-slider {
        position: absolute;
        width: 100%;
        height: 20px;
        -webkit-appearance: none !important;
        background: transparent !important;
        pointer-events: none;
        top: 0;
    }
    
    /* Aggressively remove all native track elements */
    .range-slider::-webkit-slider-track {
        background: transparent !important;
        border: none !important;
        height: 0 !important;
        -webkit-appearance: none !important;
    }
    
    .range-slider::-moz-range-track {
        background: transparent !important;
        border: none !important;
        height: 0 !important;
        -moz-appearance: none !important;
    }
    
    .range-slider::-webkit-slider-runnable-track {
        background: transparent !important;
        border: none !important;
        height: 0 !important;
    }
    
    .range-slider--low {
        z-index: 100 !important; /* Much higher above track */
    }
    
    .range-slider--high {
        z-index: 101 !important; /* Highest */
    }
    
    /* Thumb styling for WebKit browsers */
    .range-slider::-webkit-slider-thumb {
        pointer-events: auto;
        -webkit-appearance: none !important;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        position: relative;
        z-index: 1000 !important; /* Extremely high z-index */
        transform: translateY(-60%); /* Move thumbs up more than center */
    }
    
    .range-slider--low::-webkit-slider-thumb {
        background: #38bdf8 !important; /* Light blue for low threshold */
    }
    
    .range-slider--high::-webkit-slider-thumb {
        background: var(--accent-primary) !important; /* Standard blue for high threshold */
    }
    
    /* Thumb styling for Firefox */
    .range-slider::-moz-range-thumb {
        pointer-events: auto;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        position: relative;
        -moz-appearance: none !important;
        z-index: 1000 !important; /* Extremely high z-index */
        transform: translateY(-60%); /* Move thumbs up more than center */
    }
    
    .range-slider--low::-moz-range-thumb {
        background: #38bdf8 !important;
    }
    
    .range-slider--high::-moz-range-thumb {
        background: var(--accent-primary) !important;
    }
    
    .slider-legend {
        display: flex;
        justify-content: space-between;
        margin: 0.5rem 0;
        font-size: 0.75rem;
    }
    
    .legend-item {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 1px solid white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
</style> 