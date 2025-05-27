<script lang="ts">
    import { onMount } from 'svelte';
    import { Context } from 'runed';
    import { scaleLinear, scaleOrdinal } from 'd3-scale';
    import { arc, pie } from 'd3-shape';
    import { mean } from 'd3-array';

    // Create a Context for hover interactions
    export const windHoverContext = new Context<any | null>('windHoverPoint');

    // Props
    const {
        dataSource,
        title = 'Wind Rose',
        windNColumn = 'WIND_N',
        windEColumn = 'WIND_E',
        colorScale = ['#d0f0fd', '#94d8fb', '#4a9ff9', '#1d6feb', '#0143eb'],
        segmentCount = 16,
        speedBins = 5,
        maxSpeed: customMaxSpeed = null,
        hoveredPoint = null,
        compact = false
    } = $props<{
        dataSource: any[];
        title?: string;
        windNColumn?: string;
        windEColumn?: string;
        colorScale?: string[];
        segmentCount?: number;
        speedBins?: number;
        maxSpeed?: number | null;
        hoveredPoint?: any | null;
        compact?: boolean;
    }>();

    // State variables
    let width = $state(0);
    let height = $state(0);
    let containerElement: HTMLDivElement;
    let svgElement: SVGSVGElement;
    let loading = $state(false);
    let error = $state<string | null>(null);
    
    // Tooltip state
    let tooltipVisible = $state(false);
    let tooltipX = $state(0);
    let tooltipY = $state(0);
    let tooltipText = $state('');

    // Calculate inner dimensions accounting for margins
    const margin = { 
        top: compact ? 10 : 30, 
        right: compact ? 10 : 30, 
        bottom: compact ? 10 : 30, 
        left: compact ? 10 : 30 
    };
    let innerWidth = $derived(width - margin.left - margin.right);
    let innerHeight = $derived(height - margin.top - margin.bottom);
    let radius = $derived(Math.min(innerWidth, innerHeight) / 2);

    // Wind data processing
    interface WindDataResult {
        bins: number[][];
        maxSpeed: number;
        speedStep: number;
        dirStep: number;
    }
    
    // Calculate the wind data processing result
    function processWindData(): WindDataResult {
        if (!dataSource || !dataSource.length) return {
            bins: [],
            maxSpeed: 0,
            speedStep: 0,
            dirStep: 0
        };

        // Initialize bins for direction and speed
        const dirSegments = segmentCount;
        const dirStep = 360 / dirSegments;
        const bins: number[][] = Array(dirSegments)
            .fill(0)
            .map(() => Array(speedBins).fill(0));

        // Calculate max speed
        let maxSpeedValue = customMaxSpeed || 0;
        
        for (const d of dataSource) {
            const u = d[windEColumn] as number; // East component (u)
            const v = d[windNColumn] as number; // North component (v)
            
            // Skip entries with missing data
            if (isNaN(u) || isNaN(v)) continue;
            
            // Calculate wind speed and direction
            const speed = Math.sqrt(u * u + v * v);
            let dir = Math.atan2(v, u) * (180 / Math.PI);
            
            // Convert to meteorological convention (0° = North, clockwise)
            dir = 90 - dir;
            if (dir < 0) dir += 360;
            
            // Update max speed if needed
            if (!customMaxSpeed && speed > maxSpeedValue) {
                maxSpeedValue = speed;
            }
        }
        
        // Round up max speed for cleaner bin boundaries
        maxSpeedValue = Math.ceil(maxSpeedValue);
        const speedStep = maxSpeedValue / speedBins;
        
        // Populate bins
        for (const d of dataSource) {
            const u = d[windEColumn] as number;
            const v = d[windNColumn] as number;
            
            if (isNaN(u) || isNaN(v)) continue;
            
            const speed = Math.sqrt(u * u + v * v);
            let dir = Math.atan2(v, u) * (180 / Math.PI);
            
            // Convert to meteorological convention
            dir = 90 - dir;
            if (dir < 0) dir += 360;
            
            // Find the direction bin
            const dirBin = Math.floor(dir / dirStep);
            
            // Find the speed bin
            const speedBin = Math.min(
                speedBins - 1,
                Math.floor(speed / speedStep)
            );
            
            // Increment the count
            bins[dirBin][speedBin]++;
        }
        
        return {
            bins,
            maxSpeed: maxSpeedValue,
            speedStep,
            dirStep
        };
    }
    
    let windData = $derived(processWindData());

    // D3 helpers for creating the wind rose
    let pieGenerator = $derived(
        pie<number>()
            .sort(null)
            .value(d => 1)
    );

    let colorScaleFn = $derived(
        scaleOrdinal<string>()
            .domain([...Array(speedBins).keys()].map(String))
            .range(colorScale)
    );

    // Handle mouse over in SVG element for tooltip
    function handleMouseMove(event: MouseEvent) {
        // Get mouse position relative to the SVG
        const svgRect = svgElement.getBoundingClientRect();
        const mouseX = event.clientX - svgRect.left;
        const mouseY = event.clientY - svgRect.top;
        
        // Convert to coordinates relative to the center of the wind rose
        const centerX = margin.left + innerWidth / 2;
        const centerY = margin.top + innerHeight / 2;
        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        
        // Calculate distance from center
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Only show tooltip if within the wind rose radius
        if (distance <= radius) {
            // Calculate the speed based on distance from center
            const speedFraction = distance / radius;
            const speed = speedFraction * windData.maxSpeed;
            
            // Calculate direction angle
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            // Convert to meteorological convention (0° = North, clockwise)
            angle = 90 - angle;
            if (angle < 0) angle += 360;
            
            // Format tooltip text
            let directionName = "";
            if (angle >= 337.5 || angle < 22.5) directionName = "N";
            else if (angle >= 22.5 && angle < 67.5) directionName = "NE";
            else if (angle >= 67.5 && angle < 112.5) directionName = "E";
            else if (angle >= 112.5 && angle < 157.5) directionName = "SE";
            else if (angle >= 157.5 && angle < 202.5) directionName = "S";
            else if (angle >= 202.5 && angle < 247.5) directionName = "SW";
            else if (angle >= 247.5 && angle < 292.5) directionName = "W";
            else if (angle >= 292.5 && angle < 337.5) directionName = "NW";
            
            tooltipText = `${speed.toFixed(1)} m/s ${directionName}`;
            
            // Smart tooltip positioning to ensure it stays within viewport
            const tooltipWidth = 80;  // Width of our tooltip rect
            const tooltipHeight = 20; // Height of our tooltip rect
            
            // Default position (above cursor)
            let tipX = mouseX;
            let tipY = mouseY - 15;
            
            // Check if tooltip would go beyond top edge
            if (tipY - tooltipHeight/2 < 0) {
                // Position below cursor instead
                tipY = mouseY + 25;
            }
            
            // Check if tooltip would go beyond right edge
            if (tipX + tooltipWidth/2 > width) {
                tipX = width - tooltipWidth/2 - 5;
            }
            
            // Check if tooltip would go beyond left edge
            if (tipX - tooltipWidth/2 < 0) {
                tipX = tooltipWidth/2 + 5;
            }
            
            tooltipX = tipX;
            tooltipY = tipY;
            tooltipVisible = true;
        } else {
            tooltipVisible = false;
        }
    }
    
    function handleMouseLeave() {
        tooltipVisible = false;
    }
    
    // If an external hoveredPoint is provided, set it in the context
    $effect(() => {
        if (hoveredPoint && windHoverContext.exists()) {
            windHoverContext.set(hoveredPoint);
        }
    });

    // Update dimensions when container resizes
    onMount(() => {
        // Create a resize observer to detect container size changes
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.target === containerElement) {
                    width = entry.contentRect.width;
                    height = entry.contentRect.height;
                }
            }
        });
        
        // Start observing the container for size changes
        if (containerElement) {
            resizeObserver.observe(containerElement);
        }
        
        return () => {
            resizeObserver.disconnect();
        };
    });
</script>

<div class="chart-container" bind:this={containerElement}>
    {#if loading}
        <div class="loading">Loading wind data...</div>
    {:else if error}
        <div class="error">{error}</div>
    {:else}
        {#if !compact}
        <div class="title-container">
            <h3 class="chart-title">{title}</h3>
        </div>
        {/if}
        
        <svg 
            width={width} 
            height={height} 
            bind:this={svgElement} 
            onmousemove={handleMouseMove} 
            onmouseleave={handleMouseLeave}
            role="img"
            aria-label={title || "Wind rose chart showing wind direction and speed distribution"}
        >
            {#if radius > 0}
            <g transform={`translate(${margin.left + innerWidth / 2}, ${margin.top + innerHeight / 2})`}>
                <!-- Wind rose segments -->
                {#if windData.bins && windData.bins.length > 0}
                    {#each windData.bins as segmentData, dirIndex}
                        {#each segmentData as count, speedIndex}
                            {#if count > 0}
                                {@const angleStart = dirIndex * windData.dirStep}
                                {@const angleEnd = (dirIndex + 1) * windData.dirStep}
                                {@const outerRadius = Math.max(0, radius * ((speedIndex + 1) / speedBins))}
                                {@const innerRadius = speedIndex === 0 ? 0 : Math.max(0, radius * (speedIndex / speedBins))}
                                
                                <path
                                    d={arc()({
                                        innerRadius,
                                        outerRadius,
                                        startAngle: (angleStart * Math.PI) / 180,
                                        endAngle: (angleEnd * Math.PI) / 180
                                    })}
                                    fill={colorScaleFn(String(speedIndex))}
                                    stroke="#fff"
                                    stroke-width={compact ? 0.3 : 0.5}
                                    opacity={count ? (compact ? 0.78 : 0.85) : 0}
                                    class="wind-segment"
                                    data-direction={angleStart}
                                    data-speed-bin={speedIndex}
                                    data-count={count}
                                />
                            {/if}
                        {/each}
                    {/each}
                {/if}
                
                <!-- Direction labels (N, E, S, W) -->
                <text 
                    x="0" 
                    y={-(radius + (compact ? 4 : 10))} 
                    text-anchor="middle" 
                    class={compact ? "direction-label-compact" : "direction-label"}
                >N</text>
                <text 
                    x={radius + (compact ? 4 : 10)} 
                    y="0" 
                    text-anchor="start" 
                    dominant-baseline="middle" 
                    class={compact ? "direction-label-compact" : "direction-label"}
                >E</text>
                <text 
                    x="0" 
                    y={radius + (compact ? 9 : 15)} 
                    text-anchor="middle" 
                    class={compact ? "direction-label-compact" : "direction-label"}
                >S</text>
                <text 
                    x={-(radius + (compact ? 4 : 10))} 
                    y="0" 
                    text-anchor="end" 
                    dominant-baseline="middle" 
                    class={compact ? "direction-label-compact" : "direction-label"}
                >W</text>
                
                <!-- Concentric circles for speed reference -->
                {#each [...Array(speedBins).keys()] as i}
                    {@const circleRadius = Math.max(0, radius * ((i + 1) / speedBins))}
                    {#if circleRadius > 0}
                        <circle
                            cx="0"
                            cy="0"
                            r={circleRadius}
                            fill="none"
                            stroke={compact ? "#666" : "#ccc"}
                            stroke-width={compact ? 0.3 : 0.5}
                            stroke-dasharray={i === speedBins - 1 ? "none" : "2,2"}
                        />
                    {/if}
                    
                    <!-- Only show max speed value in compact mode -->
                    {#if i === speedBins - 1 && compact}
                        <text
                            x="-52"
                            y={-circleRadius + 12}
                            text-anchor="start"
                            class="speed-label-compact"
                            font-size="6"
                        >
                            {windData.maxSpeed.toFixed(1)} m/s
                        </text>
                    {:else if !compact}
                        <text
                            x="2"
                            y={-circleRadius + 3}
                            text-anchor="start"
                            class="speed-label"
                            font-size="8"
                        >
                            {((i + 1) * (windData.maxSpeed / speedBins)).toFixed(1)}
                        </text>
                    {/if}
                {/each}
            </g>
            {/if}
            
            <!-- Legend -->
            {#if !compact}
            <g transform={`translate(${width - margin.right - 100}, ${margin.top})`}>
                {#each [...Array(speedBins).keys()] as i}
                    <rect
                        x="0"
                        y={i * 15}
                        width="10"
                        height="10"
                        fill={colorScaleFn(String(i))}
                    />
                    <text
                        x="15"
                        y={i * 15 + 8}
                        font-size="8"
                        alignment-baseline="middle"
                    >
                        {i === 0 
                            ? `0 - ${(windData.speedStep).toFixed(1)}` 
                            : `${(i * windData.speedStep).toFixed(1)} - ${((i + 1) * windData.speedStep).toFixed(1)}`} m/s
                    </text>
                {/each}
            </g>
            {/if}
            
            <!-- Tooltip -->
            {#if tooltipVisible}
                <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                    <rect
                        x="-40"
                        y="-15"
                        width="80"
                        height="20"
                        rx="3"
                        ry="3"
                        class="tooltip-bg"
                    />
                    <text
                        x="0"
                        y="0"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        class="tooltip-text"
                    >{tooltipText}</text>
                </g>
            {/if}
        </svg>
    {/if}
</div>

<style>
    .chart-container {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    
    .title-container {
        text-align: center;
        margin-bottom: 0.5rem;
    }
    
    .chart-title {
        font-size: 1rem;
        font-weight: 500;
        margin: 0;
        color: #334155;
    }
    
    svg {
        flex: 1;
    }
    
    .loading, .error {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 1rem;
        border-radius: 0.25rem;
        text-align: center;
    }
    
    .loading {
        background-color: #f0f9ff;
        color: #0369a1;
    }
    
    .error {
        background-color: #fee2e2;
        color: #b91c1c;
    }
    
    .direction-label {
        font-size: 10px;
        fill: #e2e8f0;
        font-weight: 500;
    }
    
    .direction-label-compact {
        font-size: 7px;
        fill: #e2e8f0;
        font-weight: 600;
        opacity: 1;
    }
    
    .speed-label {
        fill: #cbd5e1;
    }
    
    .speed-label-compact {
        fill: #e2e8f0;
        font-weight: 600;
    }
    
    .speed-unit-label {
        fill: #334155;
        opacity: 0.9;
    }
    
    .tooltip-bg {
        fill: rgba(0, 0, 0, 0.8);
        pointer-events: none;
        filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.2));
    }
    
    .tooltip-text {
        fill: white;
        font-size: 10px;
        pointer-events: none;
        font-weight: 500;
    }
    
    .wind-segment:hover {
        opacity: 1;
        stroke-width: 1.5;
    }
</style> 