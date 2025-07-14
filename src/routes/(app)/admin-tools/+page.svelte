<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    
    let fixingRelations = false;
    let results: any = null;
    let error: string | null = null;
    
    async function fixRelations() {
        fixingRelations = true;
        error = null;
        results = null;
        
        try {
            const response = await fetch('/api/v1/fix-relations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Important for cookie-based auth
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fix relations');
            }
            
            results = data.results;
        } catch (err) {
            error = err instanceof Error ? err.message : 'An error occurred';
            console.error('Error fixing relations:', err);
        } finally {
            fixingRelations = false;
        }
    }
</script>

<div class="admin-tools-container">
    <h1>Admin Tools</h1>
    
    <div class="tool-section">
        <h2>Fix Field of View Relations</h2>
        <p class="description">
            This tool fixes missing report relations in the <code>field_of_view</code> and 
            <code>field_of_view_gaps</code> collections by mapping report_id text fields to 
            actual report relations.
        </p>
        
        <button 
            class="fix-button"
            on:click={fixRelations}
            disabled={fixingRelations}
        >
            {fixingRelations ? 'Fixing Relations...' : 'Fix Relations'}
        </button>
        
        {#if error}
            <div class="error-message">
                Error: {error}
            </div>
        {/if}
        
        {#if results}
            <div class="results">
                <h3>Results:</h3>
                <div class="result-group">
                    <h4>field_of_view:</h4>
                    <ul>
                        <li>Fixed: {results.field_of_view.fixed}</li>
                        <li>Failed: {results.field_of_view.failed}</li>
                        <li>No Report Found: {results.field_of_view.noReportFound}</li>
                    </ul>
                </div>
                <div class="result-group">
                    <h4>field_of_view_gaps:</h4>
                    <ul>
                        <li>Fixed: {results.field_of_view_gaps.fixed}</li>
                        <li>Failed: {results.field_of_view_gaps.failed}</li>
                        <li>No Report Found: {results.field_of_view_gaps.noReportFound}</li>
                    </ul>
                </div>
                <div class="result-group">
                    <h4>gas_reports:</h4>
                    <ul>
                        <li>Fixed: {results.gas_reports.fixed}</li>
                        <li>Failed: {results.gas_reports.failed}</li>
                    </ul>
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .admin-tools-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
    }
    
    h1 {
        color: var(--primary-color);
        margin-bottom: 2rem;
    }
    
    .tool-section {
        background: var(--card-background);
        border: 1px solid var(--card-border);
        border-radius: 8px;
        padding: 2rem;
        margin-bottom: 2rem;
    }
    
    h2 {
        margin-bottom: 1rem;
        color: var(--text-color);
    }
    
    .description {
        margin-bottom: 1.5rem;
        color: var(--text-color-secondary);
        line-height: 1.6;
    }
    
    code {
        background: var(--code-background, #f4f4f4);
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.9em;
    }
    
    .fix-button {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.75rem 2rem;
        border-radius: 4px;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .fix-button:hover:not(:disabled) {
        background: var(--primary-color-hover);
        transform: translateY(-1px);
    }
    
    .fix-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .error-message {
        margin-top: 1rem;
        padding: 1rem;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 4px;
        color: #c00;
    }
    
    .results {
        margin-top: 1.5rem;
        padding: 1.5rem;
        background: var(--background-secondary);
        border-radius: 4px;
    }
    
    .results h3 {
        margin-bottom: 1rem;
        color: var(--success-color, #4CAF50);
    }
    
    .result-group {
        margin-bottom: 1rem;
    }
    
    .result-group h4 {
        margin-bottom: 0.5rem;
        color: var(--text-color);
    }
    
    .result-group ul {
        list-style: none;
        padding-left: 1rem;
    }
    
    .result-group li {
        margin-bottom: 0.25rem;
        color: var(--text-color-secondary);
    }
</style> 