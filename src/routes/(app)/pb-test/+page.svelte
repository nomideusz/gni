<script>
    let { data } = $props();
</script>

<div class="pb-test">
    <h1>PocketBase Connection Test</h1>
    
    <div class="results">
        <div class="result-item">
            <strong>Status:</strong> 
            <span class={data.pbStatus === 'connected' ? 'success' : data.pbStatus === 'error' ? 'error' : 'unknown'}>
                {data.pbStatus}
            </span>
        </div>
        
        <div class="result-item">
            <strong>URL:</strong> {data.pbUrl}
        </div>
        
        {#if data.pbError}
            <div class="result-item error">
                <strong>Error:</strong> {data.pbError}
            </div>
        {/if}
    </div>
    
    <div class="actions">
        <a href="/login">Back to Login</a>
    </div>
</div>

<style>
    .pb-test {
        max-width: 600px;
        margin: 2rem auto;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        background-color: #fff;
    }
    
    h1 {
        margin-top: 0;
        color: #333;
        font-size: 1.8rem;
    }
    
    .results {
        margin: 1.5rem 0;
    }
    
    .result-item {
        margin-bottom: 1rem;
        padding: 0.8rem;
        border-radius: 4px;
        background-color: #f5f5f5;
    }
    
    .success {
        color: #38a169;
    }
    
    .error {
        color: #e53e3e;
    }
    
    .unknown {
        color: #718096;
    }
    
    .actions {
        margin-top: 1.5rem;
    }
    
    .actions a {
        display: inline-block;
        padding: 0.5rem 1rem;
        background-color: #4299e1;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 500;
    }
    
    .actions a:hover {
        background-color: #3182ce;
    }
</style> 