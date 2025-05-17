<script lang="ts">
  import { authContext } from '$lib/auth';
  import { onMount, onDestroy } from 'svelte';
  import { IsMounted } from 'runed';
  import { get } from 'svelte/store';
  import type { Writable } from 'svelte/store';
  
  // Define the types for our auth state
  type AuthUser = {
    id?: string;
    email?: string;
    username?: string;
    avatarUrl?: string;
    created?: string;
    updated?: string;
    [key: string]: any;
  };
  
  type AuthState = 'loggedOut' | 'loggedIn' | 'loading' | 'loggingIn' | 'loggingOut' | 'unknown';
  
  type AuthContextType = {
    isAuthenticated: boolean;
    user: AuthUser | null;
    state: AuthState;
  };
  
  // Use IsMounted to handle server/client rendering
  const isMounted = new IsMounted();
  
  // Track if the context is available
  let contextAvailable = $state(false);
  
  // Track last update time
  let lastUpdate = $state(new Date());
  
  // Track the auth store from context
  let authStore: Writable<AuthContextType> | null = $state(null);
  
  // Default values
  let auth = $state<AuthContextType>({
    isAuthenticated: false,
    user: null,
    state: 'unknown'
  });
  
  // Update auth status
  function updateStatus() {
    try {
      // Get the store from context
      authStore = authContext.getOr(null);
      
      if (authStore) {
        // Get the current value from the store
        const currentValue = get(authStore);
        // Update our local state
        auth = currentValue;
        contextAvailable = true;
      } else {
        contextAvailable = false;
      }
      
      lastUpdate = new Date();
    } catch (e) {
      contextAvailable = false;
      console.log('Auth context not available yet');
    }
  }
  
  // For debugging, expose contents in console
  $effect(() => {
    if (isMounted.current) {
      console.log('AuthStatus component loaded, context available:', contextAvailable);
      if (contextAvailable) {
        // Use $state.snapshot to avoid Svelte warning
        const authSnapshot = $state.snapshot(auth);
        console.log('Auth context values:', authSnapshot);
      }
    }
  });
  
  // Set up subscription to auth store
  let unsubscribe: (() => void) | null = null;
  
  // Update status when mounted and set up subscription
  onMount(() => {
    // Try to initialize immediately
    updateStatus();
    
    // If we have an auth store, subscribe to it
    if (authStore) {
      unsubscribe = authStore.subscribe(value => {
        auth = value;
        lastUpdate = new Date();
      });
    }
    
    // Set up an interval for context that might not be ready yet
    const interval = setInterval(() => {
      if (isMounted.current && !contextAvailable) {
        updateStatus();
        
        // If we get a context, set up subscription and clear interval
        if (authStore && !unsubscribe) {
          unsubscribe = authStore.subscribe(value => {
            auth = value;
            lastUpdate = new Date();
          });
          clearInterval(interval);
        }
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  });
  
  // Clean up subscription
  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });
</script>

<div class="auth-status-component" class:not-available={!contextAvailable}>
  <div class="auth-status">
    <h3>Authentication Status</h3>
    
    {#if !isMounted.current}
      <p class="status status--loading">Loading...</p>
    {:else if !contextAvailable}
      <p class="status status--error">Context not available</p>
    {:else}
      <div class="status-item">
        <span class="status-label">Authenticated:</span>
        <span class="status-value {auth.isAuthenticated ? 'status--success' : 'status--warning'}">
          {auth.isAuthenticated ? 'Yes' : 'No'}
        </span>
      </div>
      
      <div class="status-item">
        <span class="status-label">State:</span>
        <span class="status-badge status--{auth.state}">
          {auth.state}
        </span>
      </div>
      
      {#if auth.user}
        <div class="status-item">
          <span class="status-label">User:</span>
          <span class="status-value">{auth.user.email || auth.user.username || 'Unknown'}</span>
        </div>
        
        <div class="user-details">
          <div class="status-item">
            <span class="status-label">ID:</span>
            <span class="status-value">{auth.user.id || 'N/A'}</span>
          </div>
          
          {#if auth.user.created}
            <div class="status-item">
              <span class="status-label">Created:</span>
              <span class="status-value">{new Date(auth.user.created).toLocaleString()}</span>
            </div>
          {/if}
        </div>
      {/if}
      
      <div class="status-footer">
        <span class="update-time">Last updated: {lastUpdate.toLocaleTimeString()}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .auth-status-component {
    padding: 1rem;
    margin: 1rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
    background-color: var(--bg-secondary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    font-size: 0.85rem;
    width: 300px;
    transition: all 0.3s ease;
  }
  
  .not-available {
    opacity: 0.7;
    border-color: #ef4444;
  }
  
  .auth-status {
    text-align: left;
  }
  
  h3 {
    margin: 0 0 0.75rem 0;
    color: var(--text-primary);
    font-weight: 600;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-primary);
  }
  
  .status-item {
    display: flex;
    justify-content: space-between;
    margin: 0.5rem 0;
    padding: 0.25rem 0;
  }
  
  .status-label {
    font-weight: 500;
    color: var(--text-secondary);
  }
  
  .status-value {
    color: var(--text-primary);
  }
  
  .status-badge {
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .status--success {
    color: #10b981;
  }
  
  .status--warning {
    color: #f59e0b;
  }
  
  .status--error {
    color: #ef4444;
    text-align: center;
    padding: 0.5rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 0.25rem;
  }
  
  .status--loading {
    color: #3b82f6;
    text-align: center;
    padding: 0.5rem;
  }
  
  .status--loggedIn {
    background-color: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }
  
  .status--loggedOut {
    background-color: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }
  
  .status--loggingIn {
    background-color: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }
  
  .status--loggingOut {
    background-color: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
  
  .user-details {
    background-color: var(--bg-primary);
    border-radius: 0.375rem;
    padding: 0.5rem;
    margin: 0.5rem 0;
    border: 1px solid var(--border-primary);
  }
  
  .user-details .status-item {
    margin: 0.15rem 0;
    padding: 0.15rem 0;
    font-size: 0.75rem;
  }
  
  .status-footer {
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-primary);
    font-size: 0.7rem;
    color: var(--text-secondary);
    text-align: right;
  }
  
  .update-time {
    font-style: italic;
  }
</style> 