<svelte:options runes={true} />

<script lang="ts">
  import type { Snippet } from 'svelte';

  // Props with proper runes syntax - $props() takes no arguments
  let { 
    title = 'Page Title',
    description = '',
    showActions = true,
    primaryActionLabel = 'Primary Action',
    secondaryActionLabel = 'Secondary Action',
    pageActions = undefined,
    content,
    footer = undefined,
    children = undefined
  } = $props();
  
  // Event handling
  function dispatchPrimaryAction() {
    const event = new CustomEvent('primaryAction');
    document.dispatchEvent(event);
  }
  
  function dispatchSecondaryAction() {
    const event = new CustomEvent('secondaryAction');
    document.dispatchEvent(event);
  }
  
  function dispatchCancel() {
    const event = new CustomEvent('cancel');
    document.dispatchEvent(event);
  }
  
  function dispatchSave() {
    const event = new CustomEvent('save');
    document.dispatchEvent(event);
  }
</script>

<main class="page-layout">
  <div class="page-content">
    <header class="page-header">
      <h1 class="page-header__title">{title}</h1>
      {#if description}
        <p class="page-header__description">{description}</p>
      {/if}
      
      {#if showActions}
        <div class="page-actions page-actions--left">
          {#if pageActions}
            {@render pageActions()}
          {:else}
            <button class="button button--primary" onclick={dispatchPrimaryAction}>{primaryActionLabel}</button>
            <button class="button button--secondary" onclick={dispatchSecondaryAction}>{secondaryActionLabel}</button>
          {/if}
        </div>
      {/if}
    </header>

    <!-- Main content -->
    {#if content}
      {@render content()}
    {:else if children}
      {@render children()}
    {/if}

    <!-- Footer -->
    <footer class="page-footer">
      {#if footer}
        {@render footer()}
      {/if}
    </footer>
  </div>
</main> 