<!-- Labels.svelte -->
<script lang="ts">
    const { 
        width, 
        height, 
        margin, 
        tick_number = 10, 
        labelfory = false, 
        yoffset = 0, 
        xoffset = 0, 
        label = '' 
    } = $props();
</script>

{#if labelfory}
    <text 
        x={yoffset} 
        y={xoffset}
        transform="rotate(-90)"
        text-anchor="middle"
        font-size="12px"
        fill="#888"
    >
        {label}
    </text>
{:else}
    <!-- X-axis label if needed -->
    <text 
        x={width / 2} 
        y={height - margin.bottom / 3}
        text-anchor="middle"
        font-size="12px"
        fill="#888"
    >
        {label}
    </text>
{/if}

<style>
    text {
        font-family: sans-serif;
    }
</style> 