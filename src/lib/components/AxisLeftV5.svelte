<!-- AxisLeftV5.svelte -->
<script lang="ts">
    import { axisLeft } from 'd3-axis';
    import { select } from 'd3-selection';
    import { onMount, untrack } from 'svelte';
    
    const { 
        width, 
        height, 
        margin, 
        yScale, 
        position = "left", 
        tick_number = 10, 
        format = null,
        hideLabels = false
    } = $props<{
        width: number;
        height: number;
        margin: { top: number; right: number; bottom: number; left: number };
        yScale: any;
        position?: string;
        tick_number?: number;
        format?: Function | null;
        hideLabels?: boolean;
    }>();
    
    let yAxisElement: SVGGElement;
    
    // Function to draw/update the axis
    function updateAxis() {
        if (!yScale || !yAxisElement) return;
        
        const axis = axisLeft(yScale)
            .ticks(tick_number);
        
        if (format) {
            axis.tickFormat(format);
        }
        
        // Use the directly bound element reference
        const axisElement = select(yAxisElement);
        axisElement.call(axis as any);
        
        if (hideLabels) {
            axisElement.selectAll('.tick text').style('display', 'none');
        }
    }
    
    // Simple effect with requestAnimationFrame to prevent loops
    $effect(() => {
        if (height && width && yScale && yAxisElement) {
            requestAnimationFrame(() => {
                if (yAxisElement && yScale) {
                    updateAxis();
                }
            });
        }
    });
</script>

<g 
    bind:this={yAxisElement}
    class="y-axis"
    transform={`translate(${position === 'left' ? margin.left : width - margin.right}, 0)`}
></g>

<style>
    .y-axis line,
    .y-axis path {
        stroke: #888;
    }
    
    .y-axis text {
        fill: #888;
        font-size: 0.8rem;
    }
</style> 