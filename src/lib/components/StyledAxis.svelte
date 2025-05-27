<!-- StyledAxis.svelte -->
<script lang="ts">
  import { tick } from 'svelte';
  import { onMount } from 'svelte';
  import { select } from 'd3-selection';
  import { axisRight, axisBottom, axisLeft } from 'd3-axis';
  import { format } from 'd3-format';
  import { scaleLinear, scaleTime } from 'd3-scale';

  const {
    scale,
    width,
    height,
    margin,
    orientation = 'left', // 'left', 'right' or 'bottom'
    tickSize = 6,
    tickFormat = null,
    tickValues = null,
    showGridLines = false,
    showDomain = true,
    dashArray = "2,2",
    tickOpacity = 0.4,
    fontSize = 11,
    axisColor = "#666"
  } = $props<{
    scale: any;
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
    orientation?: 'left' | 'right' | 'bottom';
    tickSize?: number;
    tickFormat?: Function | null;
    tickValues?: any[] | null;
    showGridLines?: boolean;
    showDomain?: boolean;
    dashArray?: string;
    tickOpacity?: number;
    fontSize?: number;
    axisColor?: string;
  }>();

  let axis: any;
  let element: SVGGElement;
  
  // Calculate the transformation based on orientation
  let axisTransform = $derived(
    orientation === 'right'
      ? `translate(${width - margin.right},0)`
      : orientation === 'left'
        ? `translate(${margin.left},0)`
        : `translate(0,${height - margin.bottom})`
  );

  // Function to update the axis
  async function updateAxis() {
    // Check if element exists
    if (!element || !scale) return;
    
    // Wait for the next tick to ensure the DOM is ready
    await tick();
    
    // Create the appropriate axis based on orientation
    let axisGenerator;
    if (orientation === 'right') {
      axisGenerator = axisRight(scale);
    } else if (orientation === 'left') {
      axisGenerator = axisLeft(scale);
      // For left orientation, we need regular tick size (not grid lines yet)
      axisGenerator.tickSizeOuter(0);
      if (!showGridLines) {
        axisGenerator.tickSizeInner(tickSize);
      }
    } else {
      axisGenerator = axisBottom(scale);
    }
    
    // Configure the axis
    if (tickValues) axisGenerator.tickValues(tickValues);
    if (tickFormat) axisGenerator.tickFormat(tickFormat);
    
    // Select the element and remove existing content to prevent duplicates
    const selection = select(element);
    selection.selectAll("*").remove();
    
    // Apply grid lines separately after the basic axis setup
    if (showGridLines && orientation === 'left') {
      // For left axis, create the standard axis first
      axis = selection.call(axisGenerator);
      
      // Then add grid lines manually
      axis.selectAll(".tick line")
        .clone()
        .attr("x2", width - margin.left - margin.right)
        .attr("stroke-opacity", tickOpacity)
        .attr("stroke-dasharray", dashArray)
        .attr("class", "grid-line");
      
      // Keep only the first line (y=0) solid
      axis.selectAll(".grid-line:not(:first-of-type)")
        .attr("stroke-opacity", tickOpacity)
        .attr("stroke-dasharray", dashArray);
    } else if (showGridLines && orientation === 'right') {
      axisGenerator.tickSize(-(width - margin.left - margin.right));
      axis = selection.call(axisGenerator);
    } else {
      // For non-grid cases, just call the axis normally
      axis = selection.call(axisGenerator);
    }
    
    // Apply styling
    if (!showDomain) {
      axis.select(".domain").remove();
    }
    
    // Text position styling
    if (orientation === 'right') {
      axis.selectAll(".tick text")
        .attr("x", 4)
        .attr("dy", -4)
        .style("font-size", `${fontSize}px`);
    } else if (orientation === 'left') {
      axis.selectAll(".tick text")
        .attr("x", -8)  // Position text to the left of the axis
        .attr("dy", 3)
        .attr("text-anchor", "end")  // Right align the text
        .style("font-size", `${fontSize}px`);
    } else if (orientation === 'bottom') {
      axis.selectAll(".tick text")
        .style("font-size", `${fontSize}px`);
    }

    // Style the axis components
    axis.selectAll('.domain')
      .attr('stroke', axisColor)
      .attr('opacity', showDomain ? 0.5 : 0);
      
    axis.selectAll('.tick line')
      .attr('stroke', axisColor)
      .attr('opacity', tickOpacity);
      
    axis.selectAll('.tick text')
      .attr('fill', axisColor)
      .attr('font-size', '10px');
  }

  // Initial setup
  onMount(updateAxis);
  
  // Update axis when scale or dimensions change
  $effect(() => {
    if (scale && width && height && element) {
      // Use requestAnimationFrame to prevent infinite loops
      requestAnimationFrame(() => {
        if (element && scale) {
          updateAxis();
        }
      });
    }
  });
</script>

<g 
  bind:this={element} 
  transform={axisTransform}
  class="styled-axis"
/>

<style>
  .styled-axis {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  
  :global(.styled-axis line) {
    stroke: #999;
    stroke-width: 1px;
  }
  
  :global(.styled-axis text) {
    fill: #333;
    font-weight: 500;
  }
  
  :global(.styled-axis .grid-line) {
    stroke: #999;
    stroke-width: 1px;
  }
</style> 