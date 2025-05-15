<!-- HistogramChart.svelte -->
<script lang="ts">
  import { scaleLinear, scaleBand } from 'd3-scale';
  import { max, bin, extent } from 'd3-array';
  import { draw } from 'svelte/transition';
  import { onMount } from 'svelte';
  import StyledAxis from './StyledAxis.svelte';
  
  // Props
  const { 
    dataFile,
    dataColumn = 'CH4', 
    bins = 10,
    title = '', 
    color = '#10b981',
    xAxisLabel = 'Value',
    yAxisLabel = 'Frequency',
  } = $props<{
    dataFile: string;
    dataColumn?: string;
    bins?: number;
    title?: string;
    color?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
  }>();

  // Define data structure for DAT files
  interface DataItem {
    EPOCH_TIME: number;
    [key: string]: number | string;
  }

  // State variables
  let data = $state<DataItem[]>([]);
  let columns = $state<string[]>([]);
  let width = $state(0); // width will be set by the clientWidth
  const height = 350;
  const margin = { top: 20, right: 30, bottom: 40, left: 45 };
  let loading = $state(true);
  let error = $state<string | null>(null);
  let debugInfo = $state<string>('');
  let hoveredBin = $state<{
    x0: number,
    x1: number,
    length: number
  } | null>(null);
  let mousePosition = $state({ x: 0, y: 0 });
  let svgElement = $state<SVGSVGElement | null>(null);
  
  // Function to parse DAT file - same as in LineChart
  async function loadDatFile(filePath: string) {
    debugInfo = `Attempting to load: ${filePath}`;
    console.log(`Attempting to load data file: ${filePath}`);
    
    try {
      loading = true;
      error = null;
      
      const response = await fetch(filePath);
      debugInfo = `Fetch response status: ${response.status}`;
      console.log(`Fetch response:`, response);
      
      if (!response.ok) {
        throw new Error(`Failed to load data file: ${response.status} ${response.statusText}`);
      }
      
      const text = await response.text();
      debugInfo = `Data received: ${text.substring(0, 100)}...`;
      console.log(`Data length: ${text.length} characters`);
      
      if (!text || text.trim() === '') {
        throw new Error('File is empty or contains no data');
      }
      
      const lines = text.trim().split('\n');
      console.log(`Parsed ${lines.length} lines of data`);
      
      if (lines.length < 2) {
        throw new Error('File does not contain enough data (needs header + at least one row)');
      }
      
      // Parse header row to get column names
      columns = lines[0].trim().split(/\s+/);
      debugInfo = `Columns found: ${columns.join(', ')}`;
      console.log(`Columns found:`, columns);
      
      // Parse data rows
      const parsedData = lines.slice(1).map(line => {
        const values = line.trim().split(/\s+/);
        const item: any = {};
        
        // Map each value to its column name
        columns.forEach((col, index) => {
          item[col] = index < values.length ? parseFloat(values[index]) : null;
        });
        
        return item as DataItem;
      });
      
      data = parsedData;
      debugInfo = `Processed ${data.length} data points`;
      console.log(`Successfully processed ${data.length} data points`);
      loading = false;
    } catch (err) {
      console.error('Error loading data file:', err);
      error = err instanceof Error ? err.message : 'Unknown error loading data';
      debugInfo = `Error: ${error}`;
      loading = false;
    }
  }
  
  onMount(() => {
    console.log(`Component mounted, dataFile:`, dataFile);
    debugInfo = `Component mounted, dataFile: ${dataFile || 'none provided'}`;
    
    if (dataFile) {
      loadDatFile(dataFile);
    } else {
      error = 'No data file provided';
      loading = false;
    }
  });
  
  // Computed values for histogram  
  let histogramData = $state<any[]>([]);
  
  $effect(() => {
    if (data.length && columns.includes(dataColumn)) {
      const values = data.map(d => Number(d[dataColumn])).filter(v => !isNaN(v));
      histogramData = bin().thresholds(bins)(values);
    } else {
      histogramData = [];
    }
  });
  
  let xScale = $state<any>(null);
  
  $effect(() => {
    if (!histogramData.length || !width) {
      xScale = null;
      return;
    }
    
    const values = histogramData.flatMap((d: any) => [d.x0 ?? 0, d.x1 ?? 0]);
    const extentResult = extent(values);
    const domain: [number, number] = [+(extentResult?.[0] ?? 0), +(extentResult?.[1] ?? 1)];
    
    xScale = scaleLinear()
      .domain(domain)
      .nice()
      .range([margin.left, width - margin.right]);
  });
  
  let yScale = $state<any>(null);
  
  $effect(() => {
    if (!histogramData.length || !width) {
      yScale = null;
      return;
    }
    
    const maxCount = max(histogramData, (d: any) => d.length) || 0;
    
    yScale = scaleLinear()
      .domain([0, maxCount * 1.05]) // Add 5% padding
      .nice()
      .range([height - margin.bottom, margin.top]);
  });
  
  function handleMouseMove(event: MouseEvent) {
    if (!histogramData.length || !xScale || !yScale || !svgElement) return;
    
    // Get mouse position relative to SVG
    const svgRect = svgElement.getBoundingClientRect();
    const mouseX = event.clientX - svgRect.left;
    
    // Store current mouse position for tooltip
    mousePosition = { x: event.clientX, y: event.clientY };
    
    // Find bin that contains the mouse position
    const hovered = histogramData.find((bin: any) => {
      if (!xScale) return false;
      const binStart = xScale(bin.x0 ?? 0);
      const binEnd = xScale(bin.x1 ?? 0);
      return mouseX >= binStart && mouseX <= binEnd;
    });
    
    hoveredBin = hovered || null;
  }
  
  function handleMouseLeave() {
    hoveredBin = null;
  }
</script>

<!-- bind width of the container div to the svg width -->
<div class="wrapper" bind:clientWidth={width}>
  {#if loading}
    <div class="loading">Loading data... <span class="debug">{debugInfo}</span></div>
  {:else if error}
    <div class="error">Error: {error} <span class="debug">{debugInfo}</span></div>
  {:else if data.length && width && xScale && yScale && histogramData.length}
    <svg 
      {width} 
      {height} 
      bind:this={svgElement}
      onmousemove={handleMouseMove}
      onmouseleave={handleMouseLeave}
      role="img"
      aria-label="{title || `${dataColumn} distribution`}"
      class="chart-svg">
      {#if title}
        <text 
          x={width / 2} 
          y={margin.top / 2} 
          text-anchor="middle" 
          class="chart-title">
          {title}
        </text>
      {/if}
      
      <!-- Styled X-axis -->
      <StyledAxis
        scale={xScale}
        {width}
        {height}
        {margin}
        orientation="bottom"
        tickFormat={(d: number) => d.toFixed(2)}
        showDomain={false}
      />
      
      <!-- Styled Y-axis with gridlines -->
      <StyledAxis
        scale={yScale}
        {width}
        {height}
        {margin}
        orientation="left"
        tickFormat={(d: number) => d.toString()}
        showGridLines={true}
        showDomain={false}
        tickOpacity={0.7}
        dashArray="3,2"
      />

      <!-- Y-axis label at the top (horizontal) -->
      <g class="axis-label-group">
        <!-- Y-axis label -->
        <text
          x={margin.left}
          y={margin.top - 8}
          text-anchor="start"
          class="axis-label y-axis-label">
          {yAxisLabel}
          <!-- Arrow for Y-axis -->
          <tspan dx="5" class="axis-arrow">↑</tspan>
        </text>
        
        <!-- X-axis label with arrow -->
        <text
          x={width / 2}
          y={height - 5}
          text-anchor="middle"
          class="axis-label x-axis-label">
          {xAxisLabel}
          <!-- Arrow for X-axis -->
          <tspan dx="5" class="axis-arrow">→</tspan>
        </text>
      </g>
      
      <!-- Histogram bars -->
      {#each histogramData as bin, i}
        {@const binWidth = xScale ? (xScale(bin.x1 ?? 0) - xScale(bin.x0 ?? 0)) : 0}
        {@const barHeight = height - margin.bottom - (yScale ? yScale(bin.length) : 0)}
        
        <rect
          in:draw={{ duration: 1000, delay: i * 50 }}
          x={xScale ? xScale(bin.x0 ?? 0) : 0}
          y={yScale ? yScale(bin.length) : 0}
          width={Math.max(0, binWidth - 1)}
          height={barHeight}
          fill={color}
          stroke="#fff"
          stroke-width="1"
          class="histogram-bar"
          fill-opacity={hoveredBin === bin ? 0.9 : 0.7}
        />
      {/each}
    </svg>
    
    <!-- Tooltip -->
    {#if hoveredBin}
      <div 
        class="tooltip" 
        style="left: {xScale ? xScale((hoveredBin.x0 ?? 0 + hoveredBin.x1 ?? 0) / 2) : 0}px; top: {yScale ? yScale(hoveredBin.length) - 10 : 0}px">
        <div class="tooltip-content">
          <span class="tooltip-label">Range:</span> 
          <span class="tooltip-value">{(hoveredBin.x0 ?? 0).toFixed(4)} - {(hoveredBin.x1 ?? 0).toFixed(4)}</span>
        </div>
        <div class="tooltip-content">
          <span class="tooltip-label">Count:</span> 
          <span class="tooltip-value">{hoveredBin.length}</span>
        </div>
      </div>
    {/if}
  {:else}
    <div class="no-data">No data available for column: {dataColumn} <span class="debug">{debugInfo}</span></div>
  {/if}
</div>

<style>
  .wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }
  
  .loading, .error, .no-data {
    padding: 1rem;
    text-align: center;
    color: #666;
  }
  
  .error {
    color: #e53e3e;
  }
  
  .chart-title {
    font-size: 14px;
    font-weight: bold;
    fill: #333;
  }
  
  .axis-label {
    font-size: 12px;
    fill: #666;
  }
  
  .y-axis-label {
    font-weight: 500;
    fill: #444;
  }
  
  .x-axis-label {
    font-weight: 500;
    fill: #444;
  }
  
  .axis-arrow {
    font-size: 14px;
    font-weight: bold;
    fill: #555;
  }
  
  .chart-svg {
    cursor: crosshair;
  }
  
  .histogram-bar {
    transition: fill-opacity 0.2s;
  }
  
  .histogram-bar:hover {
    fill-opacity: 0.9;
  }
  
  .tooltip {
    position: absolute;
    font-family: sans-serif;
    min-width: 120px;
    background-color: rgba(255, 255, 255, 0.95);
    border-radius: 4px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
    padding: 8px 10px;
    font-size: 12px;
    z-index: 100;
    pointer-events: none;
    transform: translate(-50%, -100%);
    top: 0;
    left: 0;
  }
  
  .tooltip-content {
    margin: 3px 0;
  }
  
  .tooltip-label {
    font-weight: bold;
    margin-right: 5px;
  }
  
  .tooltip-value {
    color: #666;
  }
  
  .debug {
    display: block;
    margin-top: 8px;
    font-size: 12px;
    color: #999;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style> 