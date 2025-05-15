<!-- DualAxisChart.svelte -->
<script lang="ts">
  // D3 imports
  import { scaleTime, scaleLinear } from 'd3-scale';
  import { extent, max, min } from 'd3-array';
  import { line, curveBasis } from 'd3-shape';
  import { draw } from 'svelte/transition';
  import { onMount } from 'svelte';
  import StyledAxis from './StyledAxis.svelte';
  
  // Define data item type
  interface DataItem {
    [key: string]: number | string;
  }
  
  // Props
  const { 
    dataSource,
    xColumn = 'EPOCH_TIME',
    leftYColumn = 'CH4',
    rightYColumn = 'C2H6',
    leftYLabel = 'CH4 (ppm)',
    rightYLabel = 'C2H6 (ppb)',
    leftColor = '#38bdf8',
    rightColor = '#f97316',
    title = 'Dual Axis Chart',
    xAxisLabel = 'Time',
    tooltipTimeLabel = 'Time',
    tooltipUnitMultiplier = 1000
  } = $props<{
    dataSource: DataItem[];
    xColumn?: string;
    leftYColumn?: string;
    rightYColumn?: string;
    leftYLabel?: string;
    rightYLabel?: string;
    leftColor?: string;
    rightColor?: string;
    title?: string;
    xAxisLabel?: string;
    tooltipTimeLabel?: string;
    tooltipUnitMultiplier?: number;
  }>();

  // State variables
  let width = $state(0);
  let height = $state(0);
  let containerElement: HTMLDivElement; // Add container element reference
  const margin = { top: 30, right: 65, bottom: 35, left: 65 };
  let hoveredPoint = $state<DataItem | null>(null);
  let hoveredSeries = $state<'left' | 'right' | null>(null);
  let hoverPosition = $state({ x: 0, y: 0 });
  let svgElement = $state<SVGSVGElement | undefined>(undefined);
  
  // Setup resize observer
  onMount(() => {
    // Create a resize observer to detect container size changes
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === containerElement) {
          width = entry.contentRect.width;
          height = entry.contentRect.height;
          console.log(`DualAxisChart dimensions updated to: ${width}x${height}`);
        }
      }
    });
    
    // Start observing the container for size changes
    if (containerElement) {
      resizeObserver.observe(containerElement);
    }
    
    // Cleanup observer on component unmount
    return () => {
      resizeObserver.disconnect();
    };
  });
  
  // Log dimension changes to help debug
  $effect(() => {
    console.log(`DualAxisChart dimensions updated: ${width}x${height}, scales should recalculate`);
  });
  
  // Computed values for scales
  let xScale = $derived(
    width ? scaleTime()
      .domain(extent(dataSource, (d: DataItem) => new Date(Number(d[xColumn]) * 1000)) as [Date, Date])
      .range([margin.left, width - margin.right])
    : null
  );
  
  // Left Y scale (primary series)
  let leftYScale = $derived(
    width && height ? scaleLinear()
      .domain([
        (min(dataSource, (d: DataItem) => Number(d[leftYColumn])) || 0) * 0.95,
        (max(dataSource, (d: DataItem) => Number(d[leftYColumn])) || 1) * 1.05
      ] as [number, number])
      .nice()
      .range([height - margin.bottom, margin.top])
    : null
  );
  
  // Right Y scale (secondary series)
  let rightYScale = $derived(
    width && height ? scaleLinear()
      .domain([
        (min(dataSource, (d: DataItem) => Number(d[rightYColumn])) || 0) * 0.95,
        (max(dataSource, (d: DataItem) => Number(d[rightYColumn])) || 1) * 1.05
      ] as [number, number])
      .nice()
      .range([height - margin.bottom, margin.top])
    : null
  );
  
  // Line generators
  type LineGenerator = (data: DataItem[]) => string;
  
  let leftLineGenerator = $derived<LineGenerator | null>(
    xScale && leftYScale ? line<DataItem>()
      .x(d => xScale!(new Date(Number(d[xColumn]) * 1000)))
      .y(d => leftYScale!(Number(d[leftYColumn])))
      .curve(curveBasis) as LineGenerator
    : null
  );
  
  let rightLineGenerator = $derived<LineGenerator | null>(
    xScale && rightYScale ? line<DataItem>()
      .x(d => xScale!(new Date(Number(d[xColumn]) * 1000)))
      .y(d => rightYScale!(Number(d[rightYColumn])))
      .curve(curveBasis) as LineGenerator
    : null
  );
  
  // Custom format for Y-axis values
  const formatLeftYAxisTick = (d: number) => d.toFixed(2);
  const formatRightYAxisTick = (d: number) => d.toFixed(2);
  
  // Custom format for X-axis time values
  const formatXAxisTick = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  // Find nearest data point to cursor position
  function handleMouseMove(event: MouseEvent) {
    if (!dataSource.length || !xScale || !leftYScale || !rightYScale || !svgElement) return;
    
    // Get mouse position relative to SVG
    const svgRect = svgElement.getBoundingClientRect();
    const mouseX = event.clientX - svgRect.left;
    
    // Find closest data point 
    let closestPoint = null;
    let closestDistance = Infinity;
    
    dataSource.forEach((d: DataItem) => {
      const xPos = xScale(new Date(Number(d[xColumn]) * 1000));
      const distance = Math.abs(mouseX - xPos);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = d;
      }
    });
    
    if (closestPoint) {
      hoveredPoint = closestPoint;
      
      // Determine which series is closer to the mouse vertically
      const mouseY = event.clientY - svgRect.top;
      const leftY = leftYScale(Number(closestPoint[leftYColumn]));
      const rightY = rightYScale(Number(closestPoint[rightYColumn]));
      
      if (Math.abs(mouseY - leftY) < Math.abs(mouseY - rightY)) {
        hoveredSeries = 'left';
        hoverPosition = { x: xScale(new Date(Number(closestPoint[xColumn]) * 1000)), y: leftY };
      } else {
        hoveredSeries = 'right';
        hoverPosition = { x: xScale(new Date(Number(closestPoint[xColumn]) * 1000)), y: rightY };
      }
    }
  }
  
  function handleMouseLeave() {
    hoveredPoint = null;
    hoveredSeries = null;
  }
</script>

<div class="wrapper" bind:this={containerElement} bind:clientWidth={width} bind:clientHeight={height}>
  {#if dataSource.length && width && height && xScale && leftYScale && rightYScale && leftLineGenerator && rightLineGenerator}
    <svg 
      {width}
      {height}
      bind:this={svgElement}
      onmousemove={handleMouseMove}
      onmouseleave={handleMouseLeave}
      role="img"
      aria-label={title}
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
      
      <!-- Left Y-axis (primary) -->
      <StyledAxis
        scale={leftYScale}
        {width}
        {height}
        {margin}
        orientation="left"
        tickFormat={formatLeftYAxisTick}
        showGridLines={true}
        showDomain={false}
        tickOpacity={0.7}
        dashArray="3,2"
        axisColor={leftColor}
      />
      
      <!-- Right Y-axis (secondary) -->
      <StyledAxis
        scale={rightYScale}
        {width}
        {height}
        {margin}
        orientation="right"
        tickFormat={formatRightYAxisTick}
        showGridLines={false}
        showDomain={false}
        tickOpacity={0.7}
        axisColor={rightColor}
      />

      <!-- Y-axis labels -->
      <g class="axis-label-group">
        <!-- Left Y-axis label -->
        <text
          transform={`translate(${margin.left - 45}, ${height/2}) rotate(-90)`}
          text-anchor="middle"
          class="axis-label y-axis-label"
          fill={leftColor}>
          {leftYLabel}
        </text>
        
        <!-- Right Y-axis label -->
        <text
          transform={`translate(${width - margin.right + 45}, ${height/2}) rotate(90)`}
          text-anchor="middle"
          class="axis-label y-axis-label"
          fill={rightColor}>
          {rightYLabel}
        </text>
        
        <!-- X-axis label -->
        <text
          x={width / 2}
          y={height}
          text-anchor="middle"
          class="axis-label x-axis-label">
          {xAxisLabel}
          <tspan dx="5" class="axis-arrow">→</tspan>
        </text>
      </g>
      
      <!-- First line (left Y-axis) -->
      <path
        in:draw={{ duration: 1500 }}
        d={leftLineGenerator(dataSource)}
        stroke={leftColor}
        stroke-width={2}
        fill="none"
        class="data-line"
      />
      
      <!-- Second line (right Y-axis) -->
      <path
        in:draw={{ duration: 1500, delay: 200 }}
        d={rightLineGenerator(dataSource)}
        stroke={rightColor}
        stroke-width={2}
        stroke-dasharray="3,3"
        fill="none"
        class="data-line"
      />
      
      <!-- Hover indicator point -->
      {#if hoveredPoint && hoveredSeries}
        <circle 
          cx={hoverPosition.x} 
          cy={hoverPosition.y}
          r={5}
          fill={hoveredSeries === 'left' ? leftColor : rightColor}
          stroke="#fff"
          stroke-width="1.5"
          class="hover-point" />
      {/if}
      
      <!-- Legend -->
      <g class="legend" transform={`translate(${width / 2 - 100}, ${margin.top})`}>
        <!-- Left series -->
        <g>
          <rect width="12" height="12" fill={leftColor} rx="2" />
          <text x="18" y="10" font-size="12" fill="#e2e8f0" class="legend-label">
            {leftYLabel}
          </text>
        </g>
        
        <!-- Right series -->
        <g transform="translate(120, 0)">
          <rect width="12" height="12" fill={rightColor} rx="2" />
          <text x="18" y="10" font-size="12" fill="#e2e8f0" class="legend-label">
            {rightYLabel}
          </text>
        </g>
      </g>
    </svg>
    
    <!-- Tooltip -->
    {#if hoveredPoint}
      <div 
        class="tooltip" 
        style="left: {hoverPosition.x}px; top: {hoverPosition.y - 10}px">
        <div class="tooltip-time">
          <span class="tooltip-time-label">{tooltipTimeLabel}</span>
          <span class="tooltip-time-value">{new Date(Number(hoveredPoint[xColumn]) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div class="tooltip-content">
          <span class="tooltip-dot" style="background-color: {leftColor}"></span>
          <span class="tooltip-label">{leftYLabel}</span> 
          <span class="tooltip-value">{Number(hoveredPoint[leftYColumn]).toFixed(4)}</span>
        </div>
        <div class="tooltip-content">
          <span class="tooltip-dot" style="background-color: {rightColor}"></span>
          <span class="tooltip-label">{rightYLabel}</span> 
          <span class="tooltip-value">{(Number(hoveredPoint[rightYColumn]) * tooltipUnitMultiplier).toFixed(2)}</span>
        </div>
      </div>
    {/if}
  {:else}
    <div class="no-data">Loading chart data...</div>
  {/if}
</div>

<style>
  .wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  
  .chart-svg {
    cursor: crosshair;
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
    font-size: 12px;
    dominant-baseline: middle;
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
    min-width: 150px;
    background-color: rgba(42, 42, 60, 0.95);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    padding: 10px 12px;
    font-size: 12px;
    z-index: 100;
    pointer-events: none;
    transform: translate(-50%, -100%);
    top: 0;
    left: 0;
    border-left: 3px solid #3a3a4f;
  }
  
  .tooltip-time {
    border-bottom: 1px solid #3a3a4f;
    padding-bottom: 6px;
    margin-bottom: 6px;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
  }
  
  .tooltip-time-label {
    color: #7dd3fc;
  }
  
  .tooltip-time-value {
    color: #e2e8f0;
  }
  
  .tooltip-content {
    margin: 5px 0;
    display: flex;
    align-items: center;
  }
  
  .tooltip-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
  }
  
  .tooltip-label {
    font-weight: bold;
    margin-right: 5px;
    flex: 1;
    color: #cbd5e1;
  }
  
  .tooltip-value {
    color: #e2e8f0;
    font-family: monospace;
    font-size: 12px;
  }
  
  .no-data {
    padding: 1rem;
    text-align: center;
    color: #666;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style> 