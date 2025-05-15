<!-- MultiLineChart.svelte -->
<script lang="ts">
  // D3 imports
  import { scaleTime, scaleLinear, scaleOrdinal } from 'd3-scale';
  import { extent, max, min } from 'd3-array';
  import { line, curveBasis } from 'd3-shape';
  import { draw } from 'svelte/transition';
  import { onMount } from 'svelte';
  import StyledAxis from './StyledAxis.svelte';
  
  // Props
  const { 
    dataFile,
    dataSource,
    xColumn = 'EPOCH_TIME',
    yColumns = ['CH4'],
    yLabels = ['Value'],
    title = '', 
    colors = ['#8b5cf6', '#ec4899', '#f97316', '#10b981', '#38bdf8'],
    xAxisLabel = 'Time',
    yAxisLabel = 'Value',
  } = $props<{
    dataFile?: string;
    dataSource?: DataItem[];
    xColumn?: string;
    yColumns?: string[];
    yLabels?: string[];
    title?: string;
    colors?: string[];
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
  const margin = { top: 20, right: 80, bottom: 40, left: 45 };
  let loading = $state(true);
  let error = $state<string | null>(null);
  let debugInfo = $state<string>('');
  let hoveredPoint = $state<{ point: DataItem, series: string, color: string } | null>(null);
  let mousePosition = $state({ x: 0, y: 0 });
  let hoverPosition = $state({ x: 0, y: 0 });
  let svgElement = $state<SVGSVGElement | null>(null);
  
  // Format timestamp for display
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000); // Convert epoch to milliseconds
    return `${date.toLocaleTimeString()}`;
  };
  
  // Custom format for Y-axis values
  const formatYAxisTick = (d: number) => {
    return d.toFixed(2);
  };
  
  // Custom format for X-axis time values
  const formatXAxisTick = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
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
    
    if (dataSource) {
      // Use provided data directly
      data = dataSource;
      loading = false;
      // Extract column names from the first data item
      if (dataSource.length > 0) {
        columns = Object.keys(dataSource[0]);
      }
    } else if (dataFile) {
      loadDatFile(dataFile);
    } else {
      error = 'No data source provided';
      loading = false;
    }
  });
  
  // Computed values
  let xScale = $state<any>(null);
  let yScale = $state<any>(null);
  let colorScale = $state<any>(null);
  let lineGenerators = $state<Record<string, any>>({});
  
  $effect(() => {
    if (data.length && width && columns.includes(xColumn)) {
      const dates = data.map(d => new Date(Number(d[xColumn]) * 1000));
      xScale = scaleTime()
        .domain(extent(dates) as [Date, Date])
        .range([margin.left, width - margin.right]);
    } else {
      xScale = null;
    }
  });
  
  $effect(() => {
    if (!data.length || !width) {
      yScale = null;
      return;
    }
    
    // Validate that all yColumns exist in the data
    const validColumns = yColumns.filter((col: string) => columns.includes(col));
    
    if (validColumns.length === 0) {
      yScale = null;
      return;
    }
    
    // Find min and max across all series
    const allValues = data.flatMap(d => 
      validColumns.map((col: string) => Number(d[col]))
    ).filter(v => !isNaN(v));
    
    if (allValues.length === 0) {
      yScale = null;
      return;
    }
    
    const minValue = Math.min(...allValues) * 0.95;
    const maxValue = Math.max(...allValues) * 1.05;
    
    yScale = scaleLinear()
      .domain([minValue, maxValue])
      .nice()
      .range([height - margin.bottom, margin.top]);
  });
  
  // Color scale for multiple lines
  $effect(() => {
    colorScale = scaleOrdinal<string>()
      .domain(yColumns)
      .range(colors.length >= yColumns.length ? colors : colors.concat(Array(yColumns.length - colors.length).fill('#aaa')));
  });
  
  // Create line generators for each series
  $effect(() => {
    if (!xScale || !yScale || !data.length) {
      lineGenerators = {};
      return;
    }
    
    const generators: Record<string, any> = {};
    
    yColumns.forEach((column: string) => {
      if (columns.includes(column)) {
        generators[column] = line<DataItem>()
          .x(d => {
            const date = new Date(Number(d[xColumn]) * 1000);
            return xScale(date);
          })
          .y(d => {
            const value = Number(d[column]);
            return yScale(value);
          })
          .curve(curveBasis);
      }
    });
    
    lineGenerators = generators;
  });
  
  // Find nearest data point to cursor position
  function handleMouseMove(event: MouseEvent) {
    if (!data.length || !xScale || !yScale || !svgElement) return;
    
    // Get mouse position relative to SVG
    const svgRect = svgElement.getBoundingClientRect();
    const mouseX = event.clientX - svgRect.left;
    
    // Store current mouse position for tooltip
    mousePosition = { x: event.clientX, y: event.clientY };
    
    // Find closest data point across all series
    let closestPoint = null;
    let closestDistance = Infinity;
    let closestSeries = '';
    
    // Check each valid column
    yColumns.forEach((column: string) => {
      if (!columns.includes(column)) return;
      
      data.forEach(d => {
        if (!xScale) return;
        const date = new Date(Number(d[xColumn]) * 1000);
        const xPos = xScale(date);
        const distance = Math.abs(mouseX - xPos);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = d;
          closestSeries = column;
        }
      });
    });
    
    if (closestPoint && closestSeries && xScale && yScale) {
      hoveredPoint = {
        point: closestPoint,
        series: closestSeries,
        color: colorScale(closestSeries)
      };
      
      // Calculate position for hover indicator
      const date = new Date(Number(closestPoint[xColumn]) * 1000);
      const pointX = xScale(date);
      const pointY = yScale(Number(closestPoint[closestSeries]));
      hoverPosition = { x: pointX, y: pointY };
    } else {
      hoveredPoint = null;
    }
  }
  
  function handleMouseLeave() {
    hoveredPoint = null;
  }
</script>

<!-- bind width of the container div to the svg width -->
<div class="wrapper" bind:clientWidth={width}>
  {#if loading}
    <div class="loading">Loading data... <span class="debug">{debugInfo}</span></div>
  {:else if error}
    <div class="error">Error: {error} <span class="debug">{debugInfo}</span></div>
  {:else if data.length && width && xScale && yScale && Object.keys(lineGenerators).length}
    <svg 
      {width} 
      {height} 
      bind:this={svgElement}
      onmousemove={handleMouseMove}
      onmouseleave={handleMouseLeave}
      role="img"
      aria-label="{title || `Multiple series over time`}"
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
        tickFormat={formatXAxisTick}
        showDomain={false}
      />
      
      <!-- Styled Y-axis with gridlines -->
      <StyledAxis
        scale={yScale}
        {width}
        {height}
        {margin}
        orientation="left"
        tickFormat={formatYAxisTick}
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
      
      <!-- Draw each line series -->
      {#each yColumns.filter((col: string) => columns.includes(col)) as column, i}
        <path
          in:draw={{ duration: 1500, delay: i * 200 }}
          d={lineGenerators[column](data)}
          stroke={colorScale(column)}
          stroke-width={1.5}
          fill="none"
          class="data-line"
        />
      {/each}
      
      <!-- Hover indicator point -->
      {#if hoveredPoint}
        <circle 
          cx={hoverPosition.x} 
          cy={hoverPosition.y}
          r={5}
          fill={hoveredPoint.color}
          stroke="#fff"
          stroke-width="1.5"
          class="hover-point" />
      {/if}
      
      <!-- Legend -->
      <g class="legend" transform={`translate(${width - margin.right + 10}, ${margin.top})`}>
        {#each yColumns.filter((col: string) => columns.includes(col)) as column, i}
          <g transform={`translate(0, ${i * 20})`}>
            <rect 
              width="12" 
              height="12" 
              fill={colorScale(column)} 
              rx="2"
            />
            <text 
              x="18" 
              y="10" 
              font-size="12" 
              fill="#555"
              class="legend-label">
              {i < yLabels.length ? yLabels[i] : column}
            </text>
          </g>
        {/each}
      </g>
    </svg>
    
    <!-- Tooltip -->
    {#if hoveredPoint}
      <div 
        class="tooltip" 
        style="left: {hoverPosition.x}px; top: {hoverPosition.y - 10}px">
        <div class="tooltip-content">
          <span class="tooltip-label">Time:</span> 
          <span class="tooltip-value">{new Date(Number(hoveredPoint.point[xColumn]) * 1000).toLocaleTimeString()}</span>
        </div>
        <div class="tooltip-content">
          <span class="tooltip-label">{hoveredPoint.series}:</span> 
          <span class="tooltip-value">{Number(hoveredPoint.point[hoveredPoint.series]).toFixed(4)}</span>
        </div>
      </div>
    {/if}
  {:else}
    <div class="no-data">No data available for columns: {yColumns.join(', ')} <span class="debug">{debugInfo}</span></div>
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
  
  .hover-point {
    pointer-events: none;
  }
  
  .data-line {
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  
  .legend-label {
    font-family: sans-serif;
    dominant-baseline: middle;
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