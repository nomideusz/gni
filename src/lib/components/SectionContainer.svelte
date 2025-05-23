<svelte:options runes={true} />

<script lang="ts">
  import type { Snippet } from 'svelte';
  
  // Props with runes syntax
  let { 
    title = '',
    subtitle = '',
    showActions = undefined,
    sectionActions = undefined,
    children,
    width = 'medium' // 'narrow', 'medium', 'wide', 'full'
  } = $props();
</script>

<section class="page-section page-section--{width}">
  <header class="page-section__header">
    <div class="page-section__title-group">
      <h2 class="page-section__title">{title}</h2>
      {#if subtitle}
        <p class="page-section__subtitle">{subtitle}</p>
      {/if}
    </div>
    {#if showActions && sectionActions}
      <div class="page-section__actions">
        {@render sectionActions()}
      </div>
    {/if}
  </header>
  <div class="page-section__content">
    {@render children()}
  </div>
</section>

<style>
  .page-section__title-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .page-section__subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-secondary, #6b7280);
    font-weight: 400;
    font-style: italic;
  }
  
  .page-section__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
</style> 