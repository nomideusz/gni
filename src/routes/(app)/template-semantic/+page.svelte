<svelte:options runes={true} />

<script lang="ts">
    import PageTemplate from '$lib/components/PageTemplate.svelte';
    import SectionContainer from '$lib/components/SectionContainer.svelte';
    
    // Sample data with state rune
    const items = $state([
        { id: 1, name: 'Item One', status: 'active' },
        { id: 2, name: 'Item Two', status: 'pending' },
        { id: 3, name: 'Item Three', status: 'completed' }
    ]);
    
    // Event handlers
    function handleAction() {
        console.log('Action clicked');
        
        // Add a new item to demonstrate reactivity
        items.push({ id: items.length + 1, name: `Item ${items.length + 1}`, status: 'active' });
    }

    function handleDelete(id: number) {
        const index = items.findIndex(item => item.id === id);
        if (index !== -1) {
            items.splice(index, 1);
        }
    }
</script>

<PageTemplate 
    title="Semantic Template" 
    description="This template uses semantic HTML elements and reusable components"
>
    {#snippet pageActions()}
        <button class="button button--primary" onclick={handleAction}>New Item</button>
        <button class="button button--secondary" onclick={handleAction}>Export</button>
    {/snippet}

    {#snippet content()}
        <SectionContainer title="Overview Section">
            {#snippet sectionActions()}
                <button class="button button--discrete">Refresh</button>
            {/snippet}
            
            {#snippet children()}
                <p class="body">This section contains overview information and summary data.</p>
                <div class="data-display">
                    <article class="stat-card">
                        <div class="stat-card__icon">📊</div>
                        <div class="stat-card__content">
                            <h3 class="stat-card__title">Total Items</h3>
                            <div class="stat-card__value">{items.length}</div>
                            <p class="stat-card__details">12% increase from last month</p>
                        </div>
                    </article>
                </div>
            {/snippet}
        </SectionContainer>
        
        <SectionContainer title="Items List">
            {#snippet sectionActions()}
                <button class="button button--discrete">Filter</button>
                <button class="button button--discrete">Sort</button>
            {/snippet}
            
            {#snippet children()}
                <div class="table-container">
                    <div class="table">
                        <table class="table__element">
                            <thead>
                                <tr>
                                    <th class="table__header">ID</th>
                                    <th class="table__header">Name</th>
                                    <th class="table__header table__header--status">Status</th>
                                    <th class="table__header">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each items as item}
                                    <tr class="table__row">
                                        <td class="table__cell">{item.id}</td>
                                        <td class="table__cell">{item.name}</td>
                                        <td class="table__cell table__cell--status">
                                            {#if item.status === 'active'}
                                                <span class="badge badge--green">{item.status}</span>
                                            {:else if item.status === 'pending'}
                                                <span class="badge badge--yellow">{item.status}</span>
                                            {:else}
                                                <span class="badge badge--blue">{item.status}</span>
                                            {/if}
                                        </td>
                                        <td class="table__cell">
                                            <div class="actions">
                                                <button class="button button--discrete" aria-label="Edit">
                                                    <span class="icon">✏️</span>
                                                </button>
                                                <button class="button button--discrete" aria-label="Delete" onclick={() => handleDelete(item.id)}>
                                                    <span class="icon">🗑️</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                </div>
            {/snippet}
        </SectionContainer>
    {/snippet}
    
    {#snippet footer()}
        <div class="actions">
            <button class="button button--secondary" onclick={() => console.log('Cancel')}>Cancel</button>
            <button class="button button--primary" onclick={() => console.log('Save')}>Save Changes</button>
        </div>
    {/snippet}
</PageTemplate> 