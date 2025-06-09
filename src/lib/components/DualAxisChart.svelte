<!-- DualAxisChart.svelte -->
<script lang="ts">
  // D3 imports
  import { scaleTime, scaleLinear } from 'd3-scale';
  import { extent, max, min } from 'd3-array';
  import { line, curveBasis } from 'd3-shape';
  import { zoom, zoomIdentity } from 'd3';
  import { select } from 'd3-selection';
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
    tooltipUnitMultiplier = 1000,
    enableZoom = true,
    maxDataPoints = 5000, // Maximum points to render for performance
    allowFullData = true // Allow viewing all data points
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
    enableZoom?: boolean;
    maxDataPoints?: number;
    allowFullData?: boolean;
  }>();

  // State variables
  let width = $state(0);
  let height = $state(0);
  let containerElement: HTMLDivElement;
  const margin = { top: 30, right: 65, bottom: 35, left: 65 };
  let hoveredPoint = $state<DataItem | null>(null);
  let hoveredSeries = $state<'left' | 'right' | null>(null);
  let hoverPosition = $state({ x: 0, y: 0 });
  let svgElement = $state<SVGSVGElement | undefined>(undefined);
  
  // Zoom-related state
  let currentTransform = $state(zoomIdentity);
  let zoomBehavior: any = null;
  let originalXDomain = $state<[Date, Date] | null>(null);
  let isZoomed = $state(false);
  
  // Data filtering and subsampling
  let filteredData = $state<DataItem[]>([]);
  let dataStats = $state({ total: 0, displayed: 0, subsampled: false });
  let showFullData = $state(false);

  // Setup resize observer
  onMount(() => {
    // Initialize original domain
    if (dataSource.length > 0) {
      originalXDomain = extent(dataSource, (d: DataItem) => new Date(Number(d[xColumn]) * 1000)) as [Date, Date];
    }
    
    // Create a resize observer to detect container size changes with debouncing
    let resizeTimeout: ReturnType<typeof setTimeout>;
    let lastWidth = 0;
    let lastHeight = 0;
    
    const resizeObserver = new ResizeObserver(entries => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        for (const entry of entries) {
          if (entry.target === containerElement) {
            const newWidth = Math.floor(entry.contentRect.width);
            const newHeight = Math.floor(entry.contentRect.height);
            
            // Only update if dimensions actually changed by a meaningful amount
            if (Math.abs(newWidth - lastWidth) > 1 || Math.abs(newHeight - lastHeight) > 1) {
              lastWidth = newWidth;
              lastHeight = newWidth;
              width = newWidth;
              height = newHeight;
            }
          }
        }
      }, 50);
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
  
  // Handle zoom events
  function handleZoom(event: any) {
    currentTransform = event.transform;
    isZoomed = event.transform.k > 1.01; // Consider zoomed if scale > 1.01
    console.log('Zoom event:', { scale: event.transform.k, x: event.transform.x, y: event.transform.y });
  }
  
  function handleZoomEnd(event: any) {
    // Update filtered data after zoom ends for better performance
    updateFilteredData();
  }
  
  // Reset zoom to original view
  function resetZoom() {
    if (zoomBehavior && svgElement) {
      select(svgElement)
        .transition()
        .duration(750)
        .call(zoomBehavior.transform, zoomIdentity);
    }
  }
  
  // Toggle full data display
  function toggleFullData() {
    showFullData = !showFullData;
    updateFilteredData();
  }
  
  // Intelligent data subsampling based on zoom level and data density
  function subsampleData(data: DataItem[], transform: any): DataItem[] {
    // If user explicitly wants full data, show all
    if (showFullData && allowFullData) {
      return data;
    }
    
    // For reasonable data sizes, show all points
    if (data.length <= maxDataPoints) {
      return data;
    }
    
    // Calculate visible time range based on zoom/pan
    const xScale = scaleTime()
      .domain(originalXDomain || [new Date(), new Date()])
      .range([margin.left, width - margin.right]);
    
    const transformedScale = transform.rescaleX(xScale);
    const [visibleStart, visibleEnd] = transformedScale.domain();
    
    // Filter data to visible time range with some padding
    const timeBuffer = (visibleEnd.getTime() - visibleStart.getTime()) * 0.1; // 10% buffer
    const filteredToVisible = data.filter(d => {
      const time = new Date(Number(d[xColumn]) * 1000);
      return time.getTime() >= (visibleStart.getTime() - timeBuffer) && 
             time.getTime() <= (visibleEnd.getTime() + timeBuffer);
    });
    
    // When zoomed in significantly, try to show more detail
    if (transform.k > 5) {
      if (filteredToVisible.length <= maxDataPoints * 2) {
        return filteredToVisible;
      }
    }
    
    // If still too many points, subsample intelligently
    if (filteredToVisible.length > maxDataPoints) {
      const step = Math.ceil(filteredToVisible.length / maxDataPoints);
      return filteredToVisible.filter((_, i) => i % step === 0);
    }
    
    return filteredToVisible;
  }
  
  // Update filtered data based on current zoom/pan state
  function updateFilteredData() {
    if (dataSource.length === 0) {
      filteredData = [];
      dataStats = { total: 0, displayed: 0, subsampled: false };
      return;
    }
    
    const subsampled = subsampleData(dataSource, currentTransform);
    filteredData = subsampled;
    dataStats = {
      total: dataSource.length,
      displayed: subsampled.length,
      subsampled: subsampled.length < dataSource.length
    };
  }
  
  // Update filtered data when dataSource or transform changes
  $effect(() => {
    if (dataSource.length > 0 && width > 0) {
      updateFilteredData();
    }
  });
  
  // Setup zoom behavior when SVG element is available
  $effect(() => {
    if (enableZoom && svgElement && width > 0 && height > 0) {
      zoomBehavior = zoom()
        .scaleExtent([1, 50]) // Allow up to 50x zoom
        .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
        .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
        .on('zoom', handleZoom)
        .on('end', handleZoomEnd);
      
      const svgSelection = select(svgElement);
      svgSelection.call(zoomBehavior);
      
      // Prevent default scroll behavior on the SVG
      const wheelHandler = (event: WheelEvent) => {
        event.preventDefault();
        console.log('Wheel event captured and prevented');
      };
      
      svgElement.addEventListener('wheel', wheelHandler, { passive: false });
      console.log('Zoom behavior attached to SVG element');
      
      // Cleanup function
      return () => {
        if (svgElement) {
          svgElement.removeEventListener('wheel', wheelHandler);
        }
      };
    }
  });
  
  // Computed values for scales (using filtered data for Y-axis domains)
  let xScale = $derived(
    width && originalXDomain ? scaleTime()
      .domain(originalXDomain)
      .range([margin.left, width - margin.right])
    : null
  );
  
  // Transform the X scale based on current zoom/pan
  let transformedXScale = $derived(
    xScale && currentTransform ? currentTransform.rescaleX(xScale) : xScale
  );
  
  // Left Y scale (primary series) - use filtered data for better scaling
  let leftYScale = $derived(
    width && height && filteredData.length > 0 ? scaleLinear()
      .domain([
        (min(filteredData, (d: DataItem) => Number(d[leftYColumn])) || 0) * 0.95,
        (max(filteredData, (d: DataItem) => Number(d[leftYColumn])) || 1) * 1.05
      ] as [number, number])
      .nice()
      .range([height - margin.bottom, margin.top])
    : null
  );
  
  // Right Y scale (secondary series) - use filtered data for better scaling
  let rightYScale = $derived(
    width && height && filteredData.length > 0 ? scaleLinear()
      .domain([
        (min(filteredData, (d: DataItem) => Number(d[rightYColumn])) || 0) * 0.95,
        (max(filteredData, (d: DataItem) => Number(d[rightYColumn])) || 1) * 1.05
      ] as [number, number])
      .nice()
      .range([height - margin.bottom, margin.top])
    : null
  );
  
  // Line generators using transformed X scale
  type LineGenerator = (data: DataItem[]) => string;
  
  let leftLineGenerator = $derived<LineGenerator | null>(
    transformedXScale && leftYScale ? line<DataItem>()
      .x(d => transformedXScale!(new Date(Number(d[xColumn]) * 1000)))
      .y(d => leftYScale!(Number(d[leftYColumn])))
      .curve(curveBasis) as LineGenerator
    : null
  );
  
  let rightLineGenerator = $derived<LineGenerator | null>(
    transformedXScale && rightYScale ? line<DataItem>()
      .x(d => transformedXScale!(new Date(Number(d[xColumn]) * 1000)))
      .y(d => rightYScale!(Number(d[rightYColumn])))
      .curve(curveBasis) as LineGenerator
    : null
  );
  
  // Custom format for Y-axis values
  const formatLeftYAxisTick = (d: number) => d.toFixed(2);
  const formatRightYAxisTick = (d: number) => d.toFixed(2);
  
  // Custom format for X-axis time values (adaptive based on zoom level)
  const formatXAxisTick = (d: Date) => {
    const zoomScale = currentTransform.k;
    if (zoomScale > 10) {
      // High zoom - show seconds
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else if (zoomScale > 5) {
      // Medium zoom - show minutes
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      // Low zoom - show hours or date if span is large
      const domain = transformedXScale?.domain();
      if (domain) {
        const span = domain[1].getTime() - domain[0].getTime();
        if (span > 24 * 60 * 60 * 1000) { // More than 1 day
          return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
      }
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };
  
  // Find nearest data point to cursor position (use filtered data for performance)
  function handleMouseMove(event: MouseEvent) {
    if (!filteredData.length || !transformedXScale || !leftYScale || !rightYScale || !svgElement) return;
    
    // Get mouse position relative to SVG
    const svgRect = svgElement.getBoundingClientRect();
    const mouseX = event.clientX - svgRect.left;
    
    // Find closest data point in filtered data
    let closestPoint = null;
    let closestDistance = Infinity;
    
    filteredData.forEach((d: DataItem) => {
      const xPos = transformedXScale(new Date(Number(d[xColumn]) * 1000));
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
        hoverPosition = { x: transformedXScale(new Date(Number(closestPoint[xColumn]) * 1000)), y: leftY };
      } else {
        hoveredSeries = 'right';
        hoverPosition = { x: transformedXScale(new Date(Number(closestPoint[xColumn]) * 1000)), y: rightY };
      }
    }
  }
  
  function handleMouseLeave() {
    hoveredPoint = null;
    hoveredSeries = null;
  }
</script>

<div class="wrapper" bind:this={containerElement}>
  {#if enableZoom && dataSource.length > 0}
    <!-- Zoom Controls -->
    <div class="zoom-controls">
      <div class="data-info">
        <span class="data-count">
          {dataStats.displayed.toLocaleString()} / {dataStats.total.toLocaleString()} points
          {#if dataStats.subsampled}
            <span class="subsampled-indicator">subsampled</span>
          {/if}
        </span>
        {#if isZoomed}
          <span class="zoom-level">
            {currentTransform.k.toFixed(1)}x zoom
          </span>
        {/if}
      </div>
      <div class="zoom-buttons">
        {#if allowFullData && dataStats.total > maxDataPoints}
          <button 
            class="data-toggle" 
            class:active={showFullData}
            onclick={toggleFullData} 
            title={showFullData ? 'Enable subsampling for better performance' : 'Show all data points'}>
            {showFullData ? '📊 All Data' : '⚡ Performance'}
          </button>
        {/if}
        {#if isZoomed}
          <button class="zoom-reset" onclick={resetZoom} title="Reset zoom">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18"/>
              <path d="M8 12h8"/>
              <path d="M12 8v8"/>
            </svg>
            Reset
          </button>
        {/if}
      </div>
    </div>
  {/if}

  {#if filteredData.length && width && height && transformedXScale && leftYScale && rightYScale && leftLineGenerator && rightLineGenerator}
    <svg 
      {width}
      {height}
      bind:this={svgElement}
      onmousemove={handleMouseMove}
      onmouseleave={handleMouseLeave}
      role="img"
      aria-label={title}
      class="chart-svg"
      class:zoomable={enableZoom}>
      
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
        scale={transformedXScale}
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
      
      <!-- First line (right Y-axis) -->
      <path
        in:draw={{ duration: 1500 }}
        d={rightLineGenerator(filteredData)}
        stroke={rightColor}
        stroke-width={2}
        stroke-dasharray="3,3"
        fill="none"
        class="data-line"
      />
      
      <!-- Second line (left Y-axis) - rendered on top -->
      <path
        in:draw={{ duration: 1500, delay: 200 }}
        d={leftLineGenerator(filteredData)}
        stroke={leftColor}
        stroke-width={2}
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
      
      <!-- Zoom instruction overlay when not zoomed -->
      {#if enableZoom && !isZoomed && dataSource.length > 5000}
        {@const hintWidth = 200}
        {@const hintHeight = 45}
        {@const hintX = Math.min(width - hintWidth - 20, width - margin.right - hintWidth)}
        {@const hintY = Math.max(margin.top + 10, height - margin.bottom - hintHeight - 10)}
        <g class="zoom-hint" opacity="0.8">
          <rect x={hintX} y={hintY} width={hintWidth} height={hintHeight} rx="6" 
                fill="rgba(59, 130, 246, 0.9)" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
          <text x={hintX + hintWidth/2} y={hintY + 20} text-anchor="middle" 
                fill="white" font-size="12" font-family="sans-serif" font-weight="500">
            🔍 Scroll over chart to zoom
          </text>
          <text x={hintX + hintWidth/2} y={hintY + 35} text-anchor="middle" 
                fill="white" font-size="11" font-family="sans-serif">
            Drag to pan • {dataSource.length.toLocaleString()} points
          </text>
        </g>
      {/if}
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
  
  /* Zoom controls */
  .zoom-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    margin-bottom: 8px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    font-size: 12px;
  }
  
  .data-info {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  .data-count {
    color: #666;
    font-weight: 500;
  }
  
  .subsampled-indicator {
    background-color: #fbbf24;
    color: #92400e;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .zoom-level {
    color: #3b82f6;
    font-weight: 600;
  }
  
  .zoom-reset {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: background-color 0.2s;
  }
  
  .zoom-reset:hover {
    background-color: #2563eb;
  }
  
  .zoom-reset svg {
    width: 12px;
    height: 12px;
  }
  
  .data-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background-color: #6b7280;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: background-color 0.2s;
    margin-right: 8px;
  }
  
  .data-toggle:hover {
    background-color: #4b5563;
  }
  
  .data-toggle.active {
    background-color: #059669;
  }
  
  .data-toggle.active:hover {
    background-color: #047857;
  }
  
  /* Zoomable chart cursor */
  .chart-svg.zoomable {
    cursor: grab;
  }
  
  .chart-svg.zoomable:active {
    cursor: grabbing;
  }
  
  .chart-svg.zoomable:hover {
    /* Add a subtle hint that this is zoomable */
    filter: brightness(1.02);
  }
  
  /* Zoom hint styling */
  .zoom-hint {
    pointer-events: none;
  }
</style> 