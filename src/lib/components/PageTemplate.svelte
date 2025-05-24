<svelte:options runes={true} />

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface PageTemplateProps {
    title?: string;
    subtitle?: string;
    description?: string;
    showHeader?: boolean;
    showActions?: boolean;
    fullWidth?: boolean;
    noPadding?: boolean;
    pageActions?: Snippet;
    headerContent?: Snippet;
    content?: Snippet;
    footer?: Snippet;
    children?: Snippet;
  }

  // Props with proper runes syntax
  let { 
    title = '',
    subtitle = '',
    description = '',
    showHeader = true,
    showActions = true,
    fullWidth = false,
    noPadding = false,
    pageActions = undefined,
    headerContent = undefined,
    content = undefined,
    footer = undefined,
    children = undefined
  }: PageTemplateProps = $props();
  
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

<main class="page-template">
  <div class="page-template__container" class:page-template__container--full-width={fullWidth}>
    {#if showHeader && (title || subtitle || description || headerContent || (showActions && pageActions))}
      <header class="page-template__header">
        <div class="page-template__header-content">
          {#if title}
            <h1 class="page-template__title">{title}</h1>
          {/if}
          {#if subtitle}
            <p class="page-template__subtitle">{subtitle}</p>
          {/if}
          {#if description}
            <p class="page-template__description">{description}</p>
          {/if}
          {#if headerContent}
            {@render headerContent()}
          {/if}
        </div>
        
        {#if showActions && pageActions}
          <div class="page-template__actions">
            {@render pageActions()}
          </div>
        {/if}
      </header>
    {/if}

    <!-- Main content area -->
    <div class="page-template__content" class:page-template__content--no-padding={noPadding}>
      {#if content}
        {@render content()}
      {:else if children}
        {@render children()}
      {/if}
    </div>

    <!-- Footer (only if provided) -->
    {#if footer}
      <footer class="page-template__footer">
        {@render footer()}
      </footer>
    {/if}
  </div>
</main>

<style>  .page-template {    width: 100%;    min-height: 100%;    display: flex;    flex-direction: column;    overflow-x: hidden; /* Prevent horizontal scroll on the template itself */  }  .page-template__container {    width: 100%;    max-width: 1400px;    margin: 0 auto;    padding: 0 2rem;    flex: 1;    display: flex;    flex-direction: column;    box-sizing: border-box; /* Ensure padding is included in width */  }  .page-template__container--full-width {    max-width: 100%;  }  .page-template__header {    display: flex;    justify-content: space-between;    align-items: flex-start;    gap: 2rem;    padding: 1.5rem 0;    border-bottom: 1px solid var(--border-primary);    margin-bottom: 1.5rem;  }  .page-template__header-content {    flex: 1;  }

  .page-template__title {
    margin: 0 0 0.5rem 0;
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
  }

  .page-template__subtitle {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .page-template__description {
    margin: 0;
    font-size: 1.125rem;
    color: var(--text-secondary);
    max-width: 800px;
  }

  .page-template__actions {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-shrink: 0;
  }

  .page-template__content {
    flex: 1;
    width: 100%;
    overflow-x: hidden; /* Prevent horizontal overflow */
    box-sizing: border-box;
  }

  /* Ensure tables and other wide content don't overflow */
  .page-template__content :global(.table-container) {
    max-width: 100%;
    overflow-x: auto;
  }

  .page-template__content :global(table) {
    max-width: 100%;
  }

  .page-template__content :global(.filter-controls),
  .page-template__content :global(.controls-equation-container) {
    max-width: 100%;
    overflow-x: hidden;
  }

  /* Fix SectionContainer overflow when used with fullWidth */
  .page-template__content :global(.section-container) {
    max-width: 100%;
    box-sizing: border-box;
  }

  .page-template__content--no-padding {
    margin: -2rem;
    padding: 0;
  }

  .page-template__footer {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border-primary);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .page-template__container {
      padding: 0 1rem;
    }

    .page-template__header {
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.5rem 0;
    }

    .page-template__title {
      font-size: 2rem;
    }

    .page-template__subtitle {
      font-size: 1.125rem;
    }

    .page-template__description {
      font-size: 1rem;
    }

    .page-template__actions {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }
  }
</style> 