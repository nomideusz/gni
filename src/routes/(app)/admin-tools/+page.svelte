<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    
    let fixingRelations = false;
    let results: any = null;
    let error: string | null = null;

    // Quick Sync state
    let syncStatus: { ok?: boolean; gniSchedulerRunning?: boolean; wwuSchedulerRunning?: boolean; uptime?: number } | null = null;
    let syncError: string | null = null;
    let syncMessage: string | null = null;
    let triggeringSync = false;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    async function fetchSyncStatus() {
        try {
            const res = await fetch('/api/v1/trigger-sync', { credentials: 'include' });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            syncStatus = await res.json();
            syncError = null;
        } catch (err) {
            syncError = err instanceof Error ? err.message : 'Failed to fetch status';
            syncStatus = null;
        }
    }

    async function triggerQuickSync(type: 'gni' | 'wwu', force = false) {
        triggeringSync = true;
        syncMessage = null;
        syncError = null;
        try {
            const res = await fetch('/api/v1/trigger-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type, force })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
            syncMessage = data.message || 'Sync triggered successfully';
            // Start polling status while sync is running
            startPolling();
            // Refresh status immediately
            await fetchSyncStatus();
        } catch (err) {
            syncError = err instanceof Error ? err.message : 'Failed to trigger sync';
        } finally {
            triggeringSync = false;
        }
    }

    function startPolling() {
        if (pollingInterval) return;
        pollingInterval = setInterval(async () => {
            await fetchSyncStatus();
            // Stop polling after a reasonable time
            if (syncStatus && syncStatus.ok) {
                stopPolling();
            }
        }, 5000);
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    onMount(() => {
        fetchSyncStatus();
        return () => stopPolling();
    });
    
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

    <!-- Quick Sync Section -->
    <div class="tool-section">
        <h2>⚡ Quick Sync</h2>
        <p class="description">
            Trigger an on-demand data sync from ArcGIS without waiting for the scheduled cron job.
            A <strong>quick sync</strong> only fetches changes since last sync. A <strong>force sync</strong> re-fetches everything.
        </p>

        {#if syncStatus}
            <div class="sync-status">
                <div class="status-row">
                    <span class="status-label">Webhook:</span>
                    <span class="status-badge success">Online</span>
                </div>
                <div class="status-row">
                    <span class="status-label">GNI Scheduler:</span>
                    <span class="status-badge" class:success={syncStatus.gniSchedulerRunning} class:idle={!syncStatus.gniSchedulerRunning}>
                        {syncStatus.gniSchedulerRunning ? '✅ Running' : '❌ Stopped'}
                    </span>
                </div>
                <div class="status-row">
                    <span class="status-label">WWU Scheduler:</span>
                    <span class="status-badge" class:success={syncStatus.wwuSchedulerRunning} class:idle={!syncStatus.wwuSchedulerRunning}>
                        {syncStatus.wwuSchedulerRunning ? '✅ Running' : '❌ Stopped'}
                    </span>
                </div>
            </div>
        {:else if syncError}
            <div class="error-message">Webhook: {syncError}</div>
        {:else}
            <p class="description">Checking webhook status...</p>
        {/if}

        <div class="sync-buttons">
            <div class="sync-group">
                <h4>🇮🇪 Gas Networks Ireland</h4>
                <div class="button-row">
                    <button
                        class="fix-button sync-btn"
                        on:click={() => triggerQuickSync('gni', false)}
                        disabled={triggeringSync || !(syncStatus?.gniSchedulerRunning)}
                    >
                        Quick Sync
                    </button>
                    <button
                        class="fix-button sync-btn force"
                        on:click={() => triggerQuickSync('gni', true)}
                        disabled={triggeringSync || !(syncStatus?.gniSchedulerRunning)}
                    >
                        Force Full Sync
                    </button>
                </div>
            </div>
            <div class="sync-group">
                <h4>🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales &amp; West Utilities</h4>
                <div class="button-row">
                    <button
                        class="fix-button sync-btn"
                        on:click={() => triggerQuickSync('wwu', false)}
                        disabled={triggeringSync || !(syncStatus?.wwuSchedulerRunning)}
                    >
                        Quick Sync
                    </button>
                    <button
                        class="fix-button sync-btn force"
                        on:click={() => triggerQuickSync('wwu', true)}
                        disabled={triggeringSync || !(syncStatus?.wwuSchedulerRunning)}
                    >
                        Force Full Sync
                    </button>
                </div>
            </div>
        </div>

        {#if syncMessage}
            <div class="success-message">✅ {syncMessage}</div>
        {/if}

        <button class="refresh-status-btn" on:click={fetchSyncStatus}>↻ Refresh Status</button>
    </div>

    <div class="tool-section">
        <h2>Fix All Relations</h2>
        <p class="description">
            This tool fixes missing report relations across all collections by mapping 
            <code>report_id</code> text fields to actual PocketBase relation fields. It repairs:
        </p>
        <ul class="description-list">
            <li><strong>driving_sessions → report</strong>: Links surveys to their reports (fixes missing vehicle/car info)</li>
            <li><strong>gas_reports → driving_sessions</strong>: Adds driving sessions to report forward-relation (fixes empty surveys)</li>
            <li><strong>indications → report</strong>: Links LISA indications to their reports (fixes missing indication counts)</li>
            <li><strong>field_of_view → report</strong>: Links FOV records to reports</li>
            <li><strong>field_of_view_gaps → report</strong>: Links FOV gap records to reports</li>
            <li><strong>gas_reports → field_of_view / field_of_view_gaps</strong>: Forward-relation arrays</li>
        </ul>
        
        <button 
            class="fix-button"
            on:click={fixRelations}
            disabled={fixingRelations}
        >
            {fixingRelations ? 'Fixing Relations...' : 'Fix All Relations'}
        </button>
        
        {#if error}
            <div class="error-message">
                Error: {error}
            </div>
        {/if}
        
        {#if results}
            <div class="results">
                <h3>Results:</h3>
                
                {#if results.driving_sessions}
                    <div class="result-group">
                        <h4>🚗 driving_sessions (surveys → reports):</h4>
                        <ul>
                            <li class:success={results.driving_sessions.fixed > 0}>Fixed: {results.driving_sessions.fixed}</li>
                            <li>No Report Found: {results.driving_sessions.noReportFound}</li>
                            <li>Failed: {results.driving_sessions.failed}</li>
                        </ul>
                    </div>
                {/if}
                
                {#if results.indications}
                    <div class="result-group">
                        <h4>📍 indications (LISAs → reports):</h4>
                        <ul>
                            <li class:success={results.indications.fixed > 0}>Fixed: {results.indications.fixed}</li>
                            <li>No Report Found: {results.indications.noReportFound}</li>
                            <li>Failed: {results.indications.failed}</li>
                        </ul>
                    </div>
                {/if}
                
                <div class="result-group">
                    <h4>🔭 field_of_view:</h4>
                    <ul>
                        <li class:success={results.field_of_view.fixed > 0}>Fixed: {results.field_of_view.fixed}</li>
                        <li>No Report Found: {results.field_of_view.noReportFound}</li>
                        <li>Failed: {results.field_of_view.failed}</li>
                    </ul>
                </div>
                
                <div class="result-group">
                    <h4>⚠️ field_of_view_gaps:</h4>
                    <ul>
                        <li class:success={results.field_of_view_gaps.fixed > 0}>Fixed: {results.field_of_view_gaps.fixed}</li>
                        <li>No Report Found: {results.field_of_view_gaps.noReportFound}</li>
                        <li>Failed: {results.field_of_view_gaps.failed}</li>
                    </ul>
                </div>
                
                <div class="result-group">
                    <h4>📊 gas_reports (forward relations):</h4>
                    <ul>
                        <li class:success={results.gas_reports.fixed > 0}>Fixed: {results.gas_reports.fixed}</li>
                        <li>Already OK: {results.gas_reports.alreadyOk || 0}</li>
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
        margin-bottom: 0.5rem;
        color: var(--text-color-secondary);
        line-height: 1.6;
    }
    
    .description-list {
        margin-bottom: 1.5rem;
        padding-left: 1.5rem;
        color: var(--text-color-secondary);
        line-height: 1.8;
    }
    
    .description-list li {
        margin-bottom: 0.25rem;
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
    
    /* Quick Sync styles */
    .sync-status {
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: var(--background-secondary);
        border-radius: 6px;
    }
    
    .status-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
    }
    
    .status-row:last-child {
        margin-bottom: 0;
    }
    
    .status-label {
        font-weight: 600;
        min-width: 100px;
        color: var(--text-color);
    }
    
    .status-badge {
        padding: 0.2em 0.6em;
        border-radius: 4px;
        font-size: 0.85rem;
        font-weight: 500;
    }
    
    .status-badge.success {
        background: #e8f5e9;
        color: #2e7d32;
    }
    
    .status-badge.running {
        background: #fff3e0;
        color: #e65100;
        animation: pulse 1.5s ease-in-out infinite;
    }
    
    .status-badge.idle {
        background: var(--background-secondary);
        color: var(--text-color-secondary);
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }
    
    .sync-buttons {
        display: flex;
        gap: 2rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
    }
    
    .sync-group h4 {
        margin-bottom: 0.5rem;
        color: var(--text-color);
    }
    
    .button-row {
        display: flex;
        gap: 0.5rem;
    }
    
    .sync-btn {
        padding: 0.5rem 1.25rem !important;
        font-size: 0.9rem !important;
    }
    
    .sync-btn.force {
        background: var(--text-color-secondary) !important;
    }
    
    .sync-btn.force:hover:not(:disabled) {
        background: #555 !important;
    }
    
    .success-message {
        margin-top: 1rem;
        padding: 0.75rem 1rem;
        background: #e8f5e9;
        border: 1px solid #c8e6c9;
        border-radius: 4px;
        color: #2e7d32;
    }
    
    .refresh-status-btn {
        margin-top: 1rem;
        background: none;
        border: 1px solid var(--card-border);
        padding: 0.4rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        color: var(--text-color-secondary);
        font-size: 0.85rem;
    }
    
    .refresh-status-btn:hover {
        background: var(--background-secondary);
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
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--card-border, #eee);
    }
    
    .result-group:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
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
    
    .result-group li.success {
        color: var(--success-color, #4CAF50);
        font-weight: 600;
    }
</style>
