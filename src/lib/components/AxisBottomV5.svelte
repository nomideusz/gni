<!-- AxisBottomV5.svelte -->
<script lang="ts">
    import { axisBottom } from 'd3-axis';
    import { select } from 'd3-selection';
    import { onMount, untrack } from 'svelte';
    import type { AxisDomain } from 'd3-axis';
    
    const { width, height, margin, xScale, tick_number = 10, format = null, hideLabels = false } = 
        $props<{
            width: number;
            height: number;
            margin: { top: number; right: number; bottom: number; left: number };
            xScale: any;
            tick_number?: number;
            format?: Function | null;
            hideLabels?: boolean;
        }>();
    
    let xAxisElement: SVGGElement;
    
    // Function to draw/update the axis
    function updateAxis() {
        if (!xScale || !xAxisElement) return;
        
        const axis = axisBottom(xScale)
            .ticks(tick_number);
        
        if (format) {
            axis.tickFormat(format);
        }
        
        // Use the directly bound element reference
        const axisElement = select(xAxisElement);
        axisElement.call(axis as any);
        
        if (hideLabels) {
            axisElement.selectAll('.tick text').style('display', 'none');
        }
    }
    
    // Simple effect with requestAnimationFrame to prevent loops
    $effect(() => {
        if (width && xScale && xAxisElement) {
            requestAnimationFrame(() => {
                if (xAxisElement && xScale) {
                    updateAxis();
                }
            });
        }
    });
</script>

<g 
    bind:this={xAxisElement}
    class="x-axis"
    transform={`translate(0, ${height - margin.bottom})`}
></g>

<style>
    .x-axis line,
    .x-axis path {
        stroke: #888;
    }
    
    .x-axis text {
        fill: #888;
        font-size: 0.8rem;
    }
</style> 