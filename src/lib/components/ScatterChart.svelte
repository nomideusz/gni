<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { scaleLinear } from 'd3-scale';
    import { extent, max, min } from 'd3-array';
    import AxisLeft from './AxisLeftV5.svelte';
    import AxisBottom from './AxisBottomV5.svelte';
    import Labels from './Labels.svelte';

    // Setup event dispatcher
    const dispatch = createEventDispatcher<{
      hoverPoint: DataItem | null;
    }>();

    // Props
    const { 
      dataFile,
      xColumn = 'WIND_E', 
      yColumn = 'CH4',
      title = '',
      color = '#4a9ff9',
      lineColor,
      lineOpacity = 0.6,
      lineWidth = 1.5,
      lineDashed = false,
      xAxisLabel = 'X Axis',
      yAxisLabel = 'Y Axis',
      dotSize = 5,
      dotSizeColumn,
      minDotSize = 2,
      maxDotSize = 10,
      colorColumn,
      minColor,
      maxColor = '#ff0000', // Default max color is red
      subsample = 1,
      padding = 0.05,
      showKmScale = false,
      showGrid = true,
      gridColor = '#ddd',
      gridOpacity = 0.5,
      gridDotSpacing = 8,
      preserveAspectRatio = false,
      showWindArrow = false,
      windNColumn = 'WIND_N',
      windEColumn = 'WIND_E',
      arrowColor = '#7dd3fc',
      arrowSize = 30,
      // External hover state for chart synchronization
      hoveredPoint: externalHoveredPoint = null
    } = $props<{
      dataFile: string;
      xColumn?: string;
      yColumn?: string;
      title?: string;
      color?: string;
      lineColor?: string;
      lineOpacity?: number;
      lineWidth?: number;
      lineDashed?: boolean;
      xAxisLabel?: string;
      yAxisLabel?: string;
      dotSize?: number;
      dotSizeColumn?: string;
      minDotSize?: number;
      maxDotSize?: number;
      colorColumn?: string;
      minColor?: string;
      maxColor?: string;
      subsample?: number;
      padding?: number;
      showKmScale?: boolean;
      showGrid?: boolean;
      gridColor?: string;
      gridOpacity?: number;
      gridDotSpacing?: number;
      preserveAspectRatio?: boolean;
      showWindArrow?: boolean;
      windNColumn?: string;
      windEColumn?: string;
      arrowColor?: string;
      arrowSize?: number;
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
    let width = $state(0);
    let height = $state(0);
    let containerElement: HTMLDivElement;
    const margin = { top: 30, right: 30, bottom: 35, left: 45 };
    let loading = $state(true);
    let error = $state<string | null>(null);
    let debugInfo = $state<string>('');
    let internalHoveredPoint = $state<DataItem | null>(null);
    let mousePosition = $state({ x: 0, y: 0 });
    let svgElement: SVGSVGElement;
    let tooltipPosition = $state({ x: 0, y: 0, placement: 'top' });
    
    // Use the external hover point if provided, otherwise use internal
    let activeHoveredPoint = $derived(externalHoveredPoint || internalHoveredPoint);
    
    // Scale variables
    let scaleBarLength = $state(0); // in pixels
    let scaleBarValue = $state(0); // in kilometers
    
    // Subsampled data for display
    let displayData = $derived(
      subsample > 1
        ? data.filter((_, i) => i % subsample === 0)
        : data
    );
  
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
    
    onMount(() => {
      // Create a resize observer to detect container size changes
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target === containerElement) {
            width = entry.contentRect.width;
            height = entry.contentRect.height;
            console.log(`ScatterChart dimensions updated to: ${width}x${height}`);
          }
        }
      });
      
      // Start observing the container for size changes
      if (containerElement) {
        resizeObserver.observe(containerElement);
      }
      
      // Load data file
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
  
    // Log dimension changes to help debug
    $effect(() => {
      console.log(`ScatterChart dimensions updated: ${width}x${height}, scales should recalculate`);
    });
    
    // Computed scales with padding and aspect ratio preservation
    let xExtent = $derived(
      data.length && columns.includes(xColumn)
        ? (() => {
            const minVal = min(data, (d: DataItem) => Number(d[xColumn])) || 0;
            const maxVal = max(data, (d: DataItem) => Number(d[xColumn])) || 1;
            const range = maxVal - minVal;
            return [
              minVal - (range * padding),
              maxVal + (range * padding)
            ];
          })()
        : [0, 1]
    );
    
    let yExtent = $derived(
      data.length && columns.includes(yColumn)
        ? (() => {
            const minVal = min(data, (d: DataItem) => Number(d[yColumn])) || 0;
            const maxVal = max(data, (d: DataItem) => Number(d[yColumn])) || 1;
            const range = maxVal - minVal;
            return [
              minVal - (range * padding),
              maxVal + (range * padding)
            ];
          })()
        : [0, 1]
    );
    
    // Calculate the domain that preserves aspect ratio if needed
    let equalizedExtents = $derived(
      preserveAspectRatio && data.length
        ? (() => {
            // Available space for the plot
            const plotWidth = width - margin.left - margin.right;
            const plotHeight = height - margin.top - margin.bottom;
            
            // Current ranges in data units
            const xRange = xExtent[1] - xExtent[0];
            const yRange = yExtent[1] - yExtent[0];
            
            // Calculate pixel-per-unit ratio for both axes
            const xPixelsPerUnit = plotWidth / xRange;
            const yPixelsPerUnit = plotHeight / yRange;
            
            // Determine which axis needs adjustment
            if (xPixelsPerUnit > yPixelsPerUnit) {
              // X axis has more pixels per unit, so expand X range
              const targetXRange = plotWidth * (yRange / plotHeight);
              const halfDiff = (targetXRange - xRange) / 2;
              return {
                x: [xExtent[0] - halfDiff, xExtent[1] + halfDiff],
                y: [...yExtent]
              };
            } else {
              // Y axis has more pixels per unit, so expand Y range
              const targetYRange = plotHeight * (xRange / plotWidth);
              const halfDiff = (targetYRange - yRange) / 2;
              return {
                x: [...xExtent],
                y: [yExtent[0] - halfDiff, yExtent[1] + halfDiff]
              };
            }
          })()
        : { x: xExtent, y: yExtent }
    );
    
    let xScale = $derived(
      data.length && width
        ? scaleLinear()
            .domain(equalizedExtents.x)
            .range([margin.left, width - margin.right])
        : null
    );
  
    let yScale = $derived(
      data.length && width
        ? scaleLinear()
            .domain(equalizedExtents.y)
            .range([height - margin.bottom, margin.top])
        : null
    );
    
    // Calculate kilometer scale bar (for GPS coordinates)
    $effect(() => {
      if (showKmScale && data.length && xScale && yScale && 
          xColumn.includes('LONG') && yColumn.includes('LAT')) {
        
        // Get the domain extents
        const xDomain = xScale.domain();
        const yDomain = yScale.domain();
        
        // Calculate a reasonable length for scale bar (about 20% of chart width)
        const targetPixelLength = (width - margin.left - margin.right) * 0.2;
        
        // For longitude at this latitude, calculate kilometers per degree
        // Using approximation: 1 degree longitude at equator ≈ 111km, adjusted by cos(latitude)
        const centerLat = (yDomain[0] + yDomain[1]) / 2;
        const kmPerLongDegree = 111 * Math.cos(centerLat * Math.PI / 180);
        
        // Calculate a nice round number of kilometers
        const xRangeInKm = (xDomain[1] - xDomain[0]) * kmPerLongDegree;
        const scaleInKm = getNiceRoundNumber(xRangeInKm * 0.2);
        
        // Convert back to degrees longitude
        const scaleLengthInDegrees = scaleInKm / kmPerLongDegree;
        const scaleLengthInPixels = Math.abs(xScale(xDomain[0] + scaleLengthInDegrees) - xScale(xDomain[0]));
        
        scaleBarLength = scaleLengthInPixels;
        scaleBarValue = scaleInKm;
        
        console.log(`Scale bar: ${scaleBarValue} km, ${scaleBarLength}px`);
      }
    });
    
    // Helper function to get nice round numbers for scale
    function getNiceRoundNumber(value: number): number {
      const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
      const normalized = value / magnitude;
      
      if (normalized < 1.5) return magnitude;
      if (normalized < 3.5) return 2 * magnitude;
      if (normalized < 7.5) return 5 * magnitude;
      return 10 * magnitude;
    }
    
    // Dot size calculation
    let minDataValue = $derived(
      dotSizeColumn && data.length && columns.includes(dotSizeColumn)
        ? min(data, (d: DataItem) => Number(d[dotSizeColumn])) || 0
        : 0
    );
    
    let maxDataValue = $derived(
      dotSizeColumn && data.length && columns.includes(dotSizeColumn)
        ? max(data, (d: DataItem) => Number(d[dotSizeColumn])) || 1
        : 1
    );
    
    // Color scale calculation
    let minColorValue = $derived(
      colorColumn && data.length && columns.includes(colorColumn)
        ? min(data, (d: DataItem) => Number(d[colorColumn])) || 0
        : 0
    );
    
    let maxColorValue = $derived(
      colorColumn && data.length && columns.includes(colorColumn)
        ? max(data, (d: DataItem) => Number(d[colorColumn])) || 1
        : 1
    );
    
    // Function to calculate dot size for a data point
    function getDotSize(point: DataItem): number {
      if (dotSizeColumn && columns.includes(dotSizeColumn)) {
        const value = Number(point[dotSizeColumn]);
        
        // Handle case where min and max are the same
        if (minDataValue === maxDataValue) {
          return (minDotSize + maxDotSize) / 2;
        }
        
        // Calculate normalized value and map to dot size range
        const normalizedValue = (value - minDataValue) / (maxDataValue - minDataValue);
        return minDotSize + normalizedValue * (maxDotSize - minDotSize);
      }
      return dotSize;
    }
    
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
    
    // Function to get color for a data point
    function getDotColor(point: DataItem): string {
      if (colorColumn && columns.includes(colorColumn)) {
        const value = Number(point[colorColumn]);
        
        // Handle case where min and max are the same
        if (minColorValue === maxColorValue) {
          return color;
        }
        
        // Calculate normalized value for color interpolation
        const normalizedValue = (value - minColorValue) / (maxColorValue - minColorValue);
        
        // Interpolate between min color (or default color) and max color
        return interpolateColor(minColor || color, maxColor, normalizedValue);
      }
      return color;
    }

    // Find nearest data point to cursor position
    function handleMouseMove(event: MouseEvent) {
      if (!data.length || !xScale || !yScale || !svgElement) return;
      
      // Get mouse position relative to SVG
      const svgRect = svgElement.getBoundingClientRect();
      const mouseX = event.clientX - svgRect.left;
      const mouseY = event.clientY - svgRect.top;
      
      // Find closest point
      let closestPoint = data[0];
      let closestDistance = Infinity;
      
      data.forEach((d) => {
        const xPos = xScale(Number(d[xColumn]));
        const yPos = yScale(Number(d[yColumn]));
        const distance = Math.sqrt(Math.pow(mouseX - xPos, 2) + Math.pow(mouseY - yPos, 2));
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPoint = d;
        }
      });
      
      // Only show tooltip if mouse is close enough to a point
      if (closestDistance < 50) {
        internalHoveredPoint = closestPoint;
        // Dispatch the hover event for synchronization with other charts
        dispatch('hoverPoint', closestPoint);
        
        // Calculate position for tooltip in SVG coordinates
        const pointX = xScale(Number(internalHoveredPoint[xColumn]));
        const pointY = yScale(Number(internalHoveredPoint[yColumn]));
        mousePosition = { x: pointX, y: pointY };
        
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
      } else {
        internalHoveredPoint = null;
        dispatch('hoverPoint', null);
      }
    }

    function handleMouseLeave() {
      internalHoveredPoint = null;
      dispatch('hoverPoint', null);
    }

    // Calculate wind direction arrow
    function calculateWindArrow(point: DataItem): { angle: number, length: number } | null {
      if (!showWindArrow || !point || !columns.includes(windNColumn) || !columns.includes(windEColumn)) {
        return null;
      }
      
      const windN = Number(point[windNColumn]);
      const windE = Number(point[windEColumn]);
      
      // Skip if no wind data
      if (isNaN(windN) || isNaN(windE) || (windN === 0 && windE === 0)) {
        return null;
      }
      
      // Calculate angle (in radians and then convert to degrees)
      // atan2 takes (y, x) and returns angle in radians
      // Subtract from 270 degrees to get meteorological convention where
      // 0° is wind from North, 90° is wind from East
      const angle = (270 - Math.atan2(windN, windE) * (180 / Math.PI)) % 360;
      
      // Calculate magnitude of wind vector
      const length = Math.sqrt(windN * windN + windE * windE);
      
      return { angle, length };
    }
    
    // Normalize wind magnitude to arrow length
    function getArrowLength(magnitude: number): number {
      // More pronounced scaling - minimum length of 30% of arrowSize, maximum of arrowSize
      // Linear scaling based on wind magnitude
      return Math.min(arrowSize, Math.max(arrowSize * 0.3, magnitude * arrowSize * 0.3));
    }
    
    // Create arrow path for SVG
    function createArrowPath(x: number, y: number, angle: number, length: number): string {
      // Convert angle to radians for calculations
      const radians = angle * (Math.PI / 180);
      
      // Calculate endpoint of arrow shaft
      const endX = x + length * Math.sin(radians);
      const endY = y - length * Math.cos(radians);
      
      // Calculate arrow head points - larger arrow head
      const headSize = length * 0.35;
      const headAngle1 = radians + Math.PI * 0.75; // Wider head angle
      const headAngle2 = radians - Math.PI * 0.75;
      
      const headX1 = endX + headSize * Math.sin(headAngle1);
      const headY1 = endY - headSize * Math.cos(headAngle1);
      const headX2 = endX + headSize * Math.sin(headAngle2);
      const headY2 = endY - headSize * Math.cos(headAngle2);
      
      // Build path string
      return `M ${x} ${y} L ${endX} ${endY} M ${endX} ${endY} L ${headX1} ${headY1} M ${endX} ${endY} L ${headX2} ${headY2}`;
    }

    // Update the display position when the external hover point changes
    $effect(() => {
      if (externalHoveredPoint && data.length && xScale && yScale) {
        const pointX = xScale(Number(externalHoveredPoint[xColumn]));
        const pointY = yScale(Number(externalHoveredPoint[yColumn]));
        mousePosition = { x: pointX, y: pointY };
        
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
  
<div class="wrapper" bind:this={containerElement} bind:clientWidth={width} bind:clientHeight={height}>
  {#if loading}
    <div class="loading">Loading data... <span class="debug">{debugInfo}</span></div>
  {:else if error}
    <div class="error">Error: {error} <span class="debug">{debugInfo}</span></div>
  {:else if data.length && width && height && xScale && yScale}
    <svg 
      {width} 
      {height} 
      bind:this={svgElement}
      on:mousemove={handleMouseMove}
      on:mouseleave={handleMouseLeave}
      role="img"
      aria-label={title || "GPS scatter plot with data visualization"}>
      
      <!-- Background grid pattern -->
      {#if showGrid && xScale && yScale}
        <defs>
          <pattern id="dotPattern" width={gridDotSpacing} height={gridDotSpacing} patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill={gridColor} />
          </pattern>
        </defs>
        
        <!-- Draw grid lines -->
        <g class="grid-lines">
          <!-- Vertical grid lines -->
          {#each xScale.ticks(width > 600 ? 10 : 5) as tick}
            <line 
              x1={xScale(tick)} 
              y1={margin.top} 
              x2={xScale(tick)} 
              y2={height - margin.bottom}
              stroke={gridColor}
              stroke-width="0.5"
              stroke-dasharray="2,2"
              stroke-opacity={gridOpacity} />
          {/each}
          
          <!-- Horizontal grid lines -->
          {#each yScale.ticks(height > 400 ? 8 : 4) as tick}
            <line 
              x1={margin.left} 
              y1={yScale(tick)} 
              x2={width - margin.right} 
              y2={yScale(tick)}
              stroke={gridColor}
              stroke-width="0.5"
              stroke-dasharray="2,2"
              stroke-opacity={gridOpacity} />
          {/each}
          
          <!-- Dot grid background -->
          <rect 
            x={margin.left} 
            y={margin.top} 
            width={width - margin.left - margin.right} 
            height={height - margin.top - margin.bottom}
            fill="url(#dotPattern)"
            fill-opacity={gridOpacity * 0.7} />
        </g>
      {/if}
      
      {#if title}
        <text 
          x={width / 2} 
          y={margin.top / 2} 
          text-anchor="middle" 
          class="chart-title">
          {title}
        </text>
      {/if}
      
      <AxisBottom
        {width}
        {height}
        {margin}
        tick_number={width > 380 ? 8 : 4}
        {xScale}
        hideLabels={true} />
        
      <AxisLeft 
        {width} 
        {height} 
        {margin} 
        {yScale} 
        position="left"
        hideLabels={true} />
      
      <!-- Y-axis label (horizontal with arrow) -->
      <text
        x={margin.left}
        y={margin.top - 8}
        text-anchor="start"
        class="axis-label y-axis-label">
        {yAxisLabel}
        <tspan dx="5" class="axis-arrow">↑</tspan>
      </text>
      
      <!-- X-axis label -->
      <text
        x={width / 2}
        y={height -8}
        text-anchor="middle"
        class="axis-label">
        {xAxisLabel}
        <tspan dx="5" class="axis-arrow">→</tspan>
      </text>

      <!-- Draw a line connecting all points to show the path -->
      <polyline
        points={data.map(point => `${xScale(Number(point[xColumn]))},${yScale(Number(point[yColumn]))}`).join(' ')}
        fill="none"
        stroke={lineColor || color}
        stroke-width={lineWidth}
        stroke-opacity={lineOpacity}
        stroke-dasharray={lineDashed ? "4,2" : "none"}
      />

      {#each displayData as point, i}
        <circle
          cx={xScale(Number(point[xColumn]))}
          cy={yScale(Number(point[yColumn]))}
          r={getDotSize(point)}
          fill={getDotColor(point)}
          stroke="#fff"
          stroke-width="0.5"
          class="data-point" />
      {/each}
      
      <!-- Hover indicator point -->
      {#if activeHoveredPoint}
        <circle 
          cx={mousePosition.x} 
          cy={mousePosition.y}
          r={getDotSize(activeHoveredPoint) * 1.5}
          fill={getDotColor(activeHoveredPoint)}
          stroke="#fff"
          stroke-width="1.5"
          class="hover-point" />
          
        <!-- Wind direction arrow - positioned below the point to avoid tooltip -->
        {#if showWindArrow && activeHoveredPoint}
          {@const windArrow = calculateWindArrow(activeHoveredPoint)}
          {#if windArrow}
            <!-- Add this 20px vertical offset to position arrow below the point -->
            <g class="wind-arrow" transform={`translate(${mousePosition.x}, ${mousePosition.y + getDotSize(activeHoveredPoint) * 2 + 5})`}>
              <path 
                d={createArrowPath(0, 0, windArrow.angle, getArrowLength(windArrow.length))}
                stroke="#7dd3fc"
                stroke-width="2.5"
                stroke-opacity="1"
                fill="none" />
              
              <!-- Circular base for the arrow with a contrasting outline -->
              <circle cx="0" cy="0" r="3" fill="#7dd3fc" stroke="#fff" stroke-width="1" />
              
              <!-- Display wind speed to the right side of the arrow -->
              <!-- Add a background rectangle for better contrast -->
              <rect 
                x={getArrowLength(windArrow.length) / 2 - 25} 
                y="-20"
                width="50"
                height="18"
                rx="4"
                fill="rgba(22, 22, 42, 0.85)"
                stroke="#3a3a4f"
                stroke-width="1" />
                
              <text 
                x={getArrowLength(windArrow.length) / 2} 
                y="-8"
                text-anchor="middle"
                class="wind-label">
                {windArrow.length.toFixed(1)} m/s
              </text>
            </g>
          {/if}
        {/if}
      {/if}
      
      <!-- Kilometer scale bar (only for GPS coordinates) -->
      {#if showKmScale && scaleBarLength > 0 && scaleBarValue > 0}
        <g class="scale-bar" transform="translate({margin.left + 20}, {height - margin.bottom + 25})">
          <!-- Scale bar line -->
          <line
            x1="0"
            y1="0"
            x2="{scaleBarLength}"
            y2="0"
            stroke="#cbd5e1"
            stroke-width="2" />
          
          <!-- Scale tick marks -->
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#cbd5e1" stroke-width="1.5" />
          <line x1="{scaleBarLength}" y1="-4" x2="{scaleBarLength}" y2="4" stroke="#cbd5e1" stroke-width="1.5" />
          
          <!-- Scale label -->
          <text
            x="{scaleBarLength / 2}"
            y="-8"
            text-anchor="middle"
            class="scale-label">
            {scaleBarValue} km
          </text>
        </g>
      {/if}
      
      <!-- Add a color legend if using color gradient -->
      {#if colorColumn && columns.includes(colorColumn)}
        <g class="color-legend" transform="translate({width - margin.right - 250}, {margin.top})">
          <rect width="120" height="8" fill="url(#colorGradient)" />
          <text x="0" y="-5" class="legend-label" text-anchor="start">
            {colorColumn} level
          </text>
          <text x="0" y="20" class="legend-value" text-anchor="start">
            {minColorValue.toFixed(2)}
          </text>
          <text x="120" y="20" class="legend-value" text-anchor="end">
            {maxColorValue.toFixed(2)}
          </text>
          
          <!-- Define the gradient -->
          <defs>
            <linearGradient id="colorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color={minColor || color} />
              <stop offset="100%" stop-color={maxColor} />
            </linearGradient>
          </defs>
        </g>
      {/if}
    </svg>

    {#if activeHoveredPoint}
      <div 
        class="tooltip" 
        class:tooltip-bottom={tooltipPosition.placement === 'bottom'}
        style="left: {tooltipPosition.x}px; top: {tooltipPosition.y}px">
        <div class="tooltip-content">
          <span class="tooltip-label">Time:</span> 
          <span class="tooltip-value">{new Date(activeHoveredPoint.EPOCH_TIME * 1000).toLocaleTimeString()}</span>
        </div>
        <div class="tooltip-content">
          <span class="tooltip-label">CH4:</span> 
          <span class="tooltip-value">{Number(activeHoveredPoint["CH4"]).toFixed(4)} ppm</span>
        </div>
        {#if activeHoveredPoint["C2H6"] !== undefined}
          <div class="tooltip-content">
            <span class="tooltip-label">C2H6:</span> 
            <span class="tooltip-value">{Number(activeHoveredPoint["C2H6"]).toFixed(6)} ppm</span>
          </div>
        {/if}
        {#if showWindArrow && activeHoveredPoint[windNColumn] !== undefined && activeHoveredPoint[windEColumn] !== undefined}
          <div class="tooltip-content">
            <span class="tooltip-label">Wind:</span> 
            <span class="tooltip-value">{Math.sqrt(Math.pow(Number(activeHoveredPoint[windNColumn]), 2) + Math.pow(Number(activeHoveredPoint[windEColumn]), 2)).toFixed(1)} m/s</span>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="no-data">No data available for columns: {xColumn}, {yColumn} <span class="debug">{debugInfo}</span></div>
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
  
  .axis-arrow {
    font-size: 14px;
    font-weight: bold;
    fill: #555;
  }
  
  .data-point {
    cursor: pointer;
    transition: r 0.2s ease;
  }
  
  .data-point:hover {
    r: 8;
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
    z-index: 1000;
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
  
  .debug {
    display: block;
    margin-top: 8px;
    font-size: 12px;
    color: #999;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  .scale-bar {
    pointer-events: none;
  }
  
  .scale-label {
    font-size: 10px;
    fill: #e2e8f0;  /* Light text for dark background */
    font-weight: 500;
  }
  
  .color-legend {
    pointer-events: none;
  }
  
  .legend-label {
    font-size: 10px;
    fill: #e2e8f0;  /* Light text for dark background */
  }
  
  .legend-value {
    font-size: 9px;
    fill: #cbd5e1;  /* Light text for dark background */
  }
  
  .wind-arrow {
    pointer-events: none;
  }
  
  .wind-label {
    font-size: 10px;
    fill: #e2e8f0;  /* Changed from #444 to light color for dark background */
    font-weight: 600;
    stroke: #1e1e2e;  /* Dark stroke matching background */
    stroke-width: 2.5;  /* Increased from default */
    stroke-opacity: 0.9;  /* More opaque */
    paint-order: stroke;  /* Ensure stroke is behind text */
  }
</style>
  