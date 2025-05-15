<!-- LineChart.svelte -->
<script lang="ts">
    // D3 imports
    import { scaleTime, scaleLinear, scaleSequential } from 'd3-scale';
    import { extent, max, min } from 'd3-array';
    import { line, curveBasis } from 'd3-shape';
    import { draw } from 'svelte/transition';
    import { onMount, createEventDispatcher } from 'svelte';
    // Component imports
    import AxisLeft from './AxisLeftV5.svelte';
    import AxisBottom from './AxisBottomV5.svelte';
    import Labels from './Labels.svelte';
    import StyledAxis from './StyledAxis.svelte';
    
    // Setup event dispatcher
    const dispatch = createEventDispatcher<{
      hoverPoint: DataItem | null;
    }>();
    
    // Props
    const { 
      dataFile,
      yColumn = 'CH4', 
      title = '', 
      color = '#fcd34d',
      colorGradient = false,
      colorColumn,
      minColor,
      maxColor = '#ff0000',
      xAxisLabel = 'Time',
      yAxisLabel = 'ppm',
      useStyledAxis = true,
      includeZero = false,
      padding = 0.1,
      topPadding = 0.3,
      lineWidth = 2,
      showDataPoints = false,
      pointRadius = 3,
      // External hover state for chart synchronization
      hoveredPoint: externalHoveredPoint = null
    } = $props<{
      dataFile: string;
      yColumn?: string;
      title?: string;
      color?: string;
      colorGradient?: boolean;
      colorColumn?: string;
      minColor?: string;
      maxColor?: string;
      xAxisLabel?: string;
      yAxisLabel?: string;
      useStyledAxis?: boolean;
      includeZero?: boolean;
      padding?: number;
      topPadding?: number;
      lineWidth?: number;
      showDataPoints?: boolean;
      pointRadius?: number;
      hoveredPoint?: DataItem | null;
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
    let height = $state(0); // height will be set by the clientHeight
    let containerElement: HTMLDivElement; // Add container element reference
    const margin = { top: 30, right: 30, bottom: 35, left: 45 };
    let loading = $state(true);
    let error = $state<string | null>(null);
    let debugInfo = $state<string>('');
    let internalHoveredPoint = $state<DataItem | null>(null);
    let mousePosition = $state({ x: 0, y: 0 });
    let hoverPosition = $state({ x: 0, y: 0 });
    let svgElement = $state<SVGSVGElement | undefined>(undefined);
    let tooltipPosition = $state({ x: 0, y: 0, placement: 'top' });
    
    // Use the external hover point if provided, otherwise use internal
    let activeHoveredPoint = $derived(externalHoveredPoint || internalHoveredPoint);
    
    // Setup resize observer to handle container size changes
    onMount(() => {
      // Create a resize observer to detect container size changes
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target === containerElement) {
            width = entry.contentRect.width;
            height = entry.contentRect.height;
            console.log(`LineChart dimensions updated to: ${width}x${height}`);
          }
        }
      });
      
      // Start observing the container for size changes
      if (containerElement) {
        resizeObserver.observe(containerElement);
      }
      
      // Load data on mount
      console.log(`Component mounted, dataFile:`, dataFile);
      debugInfo = `Component mounted, dataFile: ${dataFile || 'none provided'}`;
      
      if (dataFile) {
        loadDatFile(dataFile);
      } else {
        error = 'No data file provided';
        loading = false;
      }
      
      // Cleanup observer on component unmount
      return () => {
        resizeObserver.disconnect();
      };
    });
    
    // Format timestamp for display
    const formatTime = (timestamp: number): string => {
      const date = new Date(timestamp * 1000); // Convert epoch to milliseconds
      return `${date.toLocaleTimeString()}`;
    };
    
    // Custom format for Y-axis values
    const formatYAxisTick = (d: number) => {
      // Format Y values as needed
      return d.toFixed(2);
    };
    
    // Custom format for X-axis time values
    const formatXAxisTick = (d: Date) => {
      // Show hour:minute:second for X-axis ticks
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    
    // Function to parse DAT file
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
    
    // Log dimension changes to help debug
    $effect(() => {
      console.log(`LineChart dimensions updated: ${width}x${height}, scales should recalculate`);
    });
    
    let xScale = $derived(
      data.length && width
        ? scaleTime()
            .domain(extent(data, (d: DataItem) => new Date(d.EPOCH_TIME * 1000)) as [Date, Date])
            .range([margin.left, width - margin.right])
        : null
    );
  
    let yScale = $derived(
      data.length && width && height && columns.includes(yColumn)
        ? scaleLinear()
            .domain((() => {
              // Get min and max values of the data
              const minVal = min(data, (d: DataItem) => Number(d[yColumn])) || 0;
              const maxVal = max(data, (d: DataItem) => Number(d[yColumn])) || 1;
              
              // Calculate domain based on includeZero and padding
              if (includeZero) {
                // Start from zero with padding at the top
                return [0, maxVal * (1 + padding)] as [number, number];
              } else {
                // Calculate range based on data with padding
                const range = maxVal - minVal;
                return [
                  minVal - (range * padding),
                  maxVal + (range * (padding + (topPadding || 0)))
                ] as [number, number];
              }
            })())
            .nice()
            .range([height - margin.bottom, margin.top])
        : null
    );
  
    let lineGenerator = $derived(
      xScale && yScale && data.length
        ? line<DataItem>()
            .x((d) => xScale(new Date(d.EPOCH_TIME * 1000)))
            .y((d) => yScale(Number(d[yColumn])))
            .curve(curveBasis)
        : null
    );
    
    // Calculate min/max for color gradient - use colorColumn if specified, otherwise use yColumn
    let minColorValue = $derived(
      data.length && columns.includes(colorColumn || yColumn)
        ? min(data, (d: DataItem) => Number(d[colorColumn || yColumn])) || 0
        : 0
    );
    
    let maxColorValue = $derived(
      data.length && columns.includes(colorColumn || yColumn)
        ? max(data, (d: DataItem) => Number(d[colorColumn || yColumn])) || 1
        : 1
    );
    
    // Convert hex color to RGB components
    function hexToRgb(hex: string): {r: number, g: number, b: number} {
      // Remove # if present
      hex = hex.replace('#', '');
      
      // Handle 3-digit hex
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      
      // Parse the hex values
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      return { r, g, b };
    }
    
    // Linear interpolation between colors
    function interpolateColor(color1: string, color2: string, factor: number): string {
      const rgb1 = hexToRgb(color1);
      const rgb2 = hexToRgb(color2);
      
      const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
      const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
      const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));
      
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    // Function to get color for a data value
    function getDataColor(point: DataItem): string {
      if (!colorGradient) {
        return color;
      }
      
      const value = Number(point[colorColumn || yColumn]);
      
      // Handle case where min and max are the same
      if (minColorValue === maxColorValue) {
        return minColor || color;
      }
      
      // Calculate normalized value for color interpolation
      const normalizedValue = (value - minColorValue) / (maxColorValue - minColorValue);
      
      // Interpolate between min color (or default color) and max color
      return interpolateColor(minColor || color, maxColor, normalizedValue);
    }
    
    // Find nearest data point to cursor position
    function handleMouseMove(event: MouseEvent) {
      if (!data.length || !xScale || !yScale || !svgElement) return;
      
      // Get mouse position relative to SVG
      const svgRect = svgElement.getBoundingClientRect();
      const mouseX = event.clientX - svgRect.left;
      
      // Store current mouse position for tooltip
      mousePosition = { x: event.clientX, y: event.clientY };
      
      // Find closest data point
      let closestPoint = data[0];
      let closestDistance = Infinity;
      
      data.forEach((d) => {
        const xPos = xScale(new Date(d.EPOCH_TIME * 1000));
        const distance = Math.abs(mouseX - xPos);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = d;
        }
      });
      
      internalHoveredPoint = closestPoint;
      
      // Dispatch the hover event for synchronization with other charts
      dispatch('hoverPoint', closestPoint);
      
      // Calculate position for hover point and tooltip
      if (internalHoveredPoint) {
        const pointX = xScale(new Date(internalHoveredPoint.EPOCH_TIME * 1000));
        const pointY = yScale(Number(internalHoveredPoint[yColumn]));
        hoverPosition = { x: pointX, y: pointY };
        
        // Determine tooltip placement based on position within chart
        // Default to above point
        let placement = 'top';
        let tooltipX = pointX;
        let tooltipY = pointY - 30;
        
        // If too close to top, place below point
        if (pointY < 100) {
          placement = 'bottom';
          tooltipY = pointY + 30;
        }
        
        // If too close to left edge, shift right
        if (pointX < 150) {
          tooltipX = Math.max(tooltipX, 150);
        }
        
        // If too close to right edge, shift left
        if (pointX > width - 150) {
          tooltipX = Math.min(tooltipX, width - 150);
        }
        
        tooltipPosition = { x: tooltipX, y: tooltipY, placement };
      }
    }
    
    function handleMouseLeave() {
      internalHoveredPoint = null;
      dispatch('hoverPoint', null);
    }
    
    // Update the display position when the external hover point changes
    $effect(() => {
      if (externalHoveredPoint && data.length && xScale && yScale) {
        const pointX = xScale(new Date(externalHoveredPoint.EPOCH_TIME * 1000));
        const pointY = yScale(Number(externalHoveredPoint[yColumn]));
        hoverPosition = { x: pointX, y: pointY };
        
        // Update tooltip placement
        let placement = 'top';
        let tooltipX = pointX;
        let tooltipY = pointY - 30;
        
        if (pointY < 100) {
          placement = 'bottom';
          tooltipY = pointY + 30;
        }
        
        if (pointX < 150) {
          tooltipX = Math.max(tooltipX, 150);
        }
        
        if (pointX > width - 150) {
          tooltipX = Math.min(tooltipX, width - 150);
        }
        
        tooltipPosition = { x: tooltipX, y: tooltipY, placement };
      }
    });
</script>
  
<!-- bind width of the container div to the svg width-->
<div class="wrapper" bind:this={containerElement} bind:clientWidth={width} bind:clientHeight={height}>
  {#if loading}
    <div class="loading">Loading data... <span class="debug">{debugInfo}</span></div>
  {:else if error}
    <div class="error">Error: {error} <span class="debug">{debugInfo}</span></div>
  {:else if data.length && width && height && xScale && yScale && lineGenerator}
    <svg 
      {width} 
      {height} 
      bind:this={svgElement}
      onmousemove={handleMouseMove}
      onmouseleave={handleMouseLeave}
      role="img"
      aria-label="{title || `${yColumn} over time`}"
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
      
      {#if useStyledAxis}
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
            {`${yColumn} (${yAxisLabel})`}
            <!-- Arrow for Y-axis -->
            <tspan dx="5" class="axis-arrow">↑</tspan>
          </text>
          
          <!-- X-axis label with arrow -->
          <text
            x={width / 2}
            y={height}
            text-anchor="middle"
            class="axis-label">
            {xAxisLabel}
            <!-- Arrow for X-axis -->
            <tspan dx="5" class="axis-arrow">→</tspan>
          </text>
        </g>
      {:else}
        <AxisBottom
          {width}
          {height}
          {margin}
          tick_number={width > 380 ? 8 : 4}
          {xScale}
          format={(d: Date) => formatTime(d.getTime() / 1000)} />
          
        <AxisLeft {width} {height} {margin} {yScale} position="left" />
        
        <!-- Y-axis label -->
        <Labels
          labelfory={true}
          {width}
          {height}
          {margin}
          tick_number={10}
          yoffset={-35}
          xoffset={15}
          label={`${yColumn} (${yAxisLabel})`} />
          
        <!-- X-axis label with arrow -->
        <text
          x={width / 2}
          y={height + 8}
          text-anchor="middle"
          class="axis-label">
          {xAxisLabel}
          <tspan dx="5" class="axis-arrow">→</tspan>
        </text>
      {/if}
      
      <!-- Add a color gradient definition if using gradients -->
      {#if colorGradient}
        <defs>
          <linearGradient id="lineGradient" gradientUnits="userSpaceOnUse"
                         x1={xScale.range()[0]} y1="0" 
                         x2={xScale.range()[1]} y2="0">
            {#each data as point, i}
              {@const value = Number(point[colorColumn || yColumn])}
              {@const normalizedValue = (value - minColorValue) / (maxColorValue - minColorValue) || 0}
              <stop 
                offset="{i / (data.length - 1) * 100}%" 
                stop-color={getDataColor(point)} />
            {/each}
          </linearGradient>
        </defs>
      {/if}
      
      <!-- Draw path with either gradient or solid color -->
      <path
        in:draw={{ duration: 1500 }}
        d={lineGenerator(data)}
        stroke={colorGradient ? "url(#lineGradient)" : color}
        stroke-width={lineWidth}
        fill="none" />
        
      <!-- Optional data points -->
      {#if showDataPoints}
        {#each data as point}
          <circle 
            cx={xScale(new Date(point.EPOCH_TIME * 1000))}
            cy={yScale(Number(point[yColumn]))}
            r={pointRadius}
            fill={colorGradient ? getDataColor(point) : color}
            stroke="#fff"
            stroke-width="0.5"
            class="data-point" />
        {/each}
      {/if}
        
      <!-- Hover indicator point -->
      {#if activeHoveredPoint}
        <circle 
          cx={hoverPosition.x} 
          cy={hoverPosition.y}
          r={5}
          fill={colorGradient ? getDataColor(activeHoveredPoint) : color}
          stroke="#fff"
          stroke-width="1.5"
          class="hover-point" />
      {/if}
      
      <!-- Add color legend if using gradient - moved above the chart area -->
      {#if colorGradient}
        <defs>
          <!-- Create a separate gradient for the legend -->
          <linearGradient id="legendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color={minColor || color} />
            <stop offset="100%" stop-color={maxColor} />
          </linearGradient>
        </defs>
        
        <g class="color-legend" transform="translate({width - margin.right - 130}, {margin.top})">
          <rect width="120" height="8" fill="url(#legendGradient)" />
          <text x="0" y="-5" class="legend-label" text-anchor="start">
            {colorColumn || yColumn} level
          </text>
          <text x="0" y="20" class="legend-value" text-anchor="start">
            {minColorValue.toFixed(2)}
          </text>
          <text x="120" y="20" class="legend-value" text-anchor="end">
            {maxColorValue.toFixed(2)}
          </text>
        </g>
      {/if}
    </svg>
    
    <!-- Tooltip -->
    {#if activeHoveredPoint}
      <div 
        class="tooltip" 
        class:tooltip-bottom={tooltipPosition.placement === 'bottom'}
        style="left: {tooltipPosition.x}px; top: {tooltipPosition.y}px">
        <div class="tooltip-content">
          <span class="tooltip-label">Time:</span> 
          <span class="tooltip-value">{new Date(activeHoveredPoint.EPOCH_TIME * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div class="tooltip-content">
          <span class="tooltip-label">{yColumn}:</span> 
          <span class="tooltip-value">{Number(activeHoveredPoint[yColumn]).toFixed(4)}</span>
        </div>
        {#if colorColumn && colorColumn !== yColumn}
          <div class="tooltip-content">
            <span class="tooltip-label">{colorColumn}:</span> 
            <span class="tooltip-value">{Number(activeHoveredPoint[colorColumn]).toFixed(4)}</span>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="no-data">No data available for column: {yColumn} <span class="debug">{debugInfo}</span></div>
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
  
  .loading, .error, .no-data {
    padding: 1rem;
    text-align: center;
    color: #666;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
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
  
  .tooltip {
    position: absolute;
    font-family: sans-serif;
    min-width: 120px;
    background-color: rgba(42, 42, 60, 0.95);
    border-radius: 4px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
    padding: 8px 10px;
    font-size: 12px;
    z-index: 100;
    pointer-events: none;
    transform: translate(-50%, -100%);
    border-left: 3px solid #3a3a4f;
  }
  
  .tooltip-bottom {
    transform: translate(-50%, 0);
  }
  
  .tooltip-content {
    margin: 3px 0;
  }
  
  .tooltip-label {
    font-weight: bold;
    margin-right: 5px;
    color: #7dd3fc;
  }
  
  .tooltip-value {
    color: #e2e8f0;
  }
  
  .data-point {
    cursor: pointer;
    transition: r 0.2s ease;
  }
  
  .data-point:hover {
    r: 6;
  }
  
  .color-legend {
    pointer-events: none;
  }
  
  .legend-label,
  .color-legend text {
    fill: #e2e8f0;  /* Light text for dark background */
    font-size: 10px;
  }
  
  .legend-value {
    fill: #cbd5e1;  /* Light text for dark background */
    font-size: 9px;
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