<script lang="ts">
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import type { SubmitFunction } from '@sveltejs/kit';
    
    // Use let instead of const for state variables in Svelte 5
    let email = $state('');
    let password = $state('');
    let error = $state('');
    let isLoading = $state(false);
    
    const handleEnhance: SubmitFunction = () => {
        // Set loading state when form is submitting
        isLoading = true;
        
        return async ({ result }) => {
            isLoading = false;
            console.log('Form submission result:', result);
            
            if (result.type === 'failure') {
                const message = result.data?.message;
                error = typeof message === 'string' ? message : 'Login failed';
            } else if (result.type === 'redirect') {
                // Instead of using goto which maintains some state, use a full page reload
                // This ensures the auth state is completely reinitialized
                window.location.href = result.location;
            } else if (result.type === 'success') {
                // Handle successful form submission without redirect
                console.log('Successful login, redirecting to homepage');
                window.location.href = '/';
            }
        };
    }
</script>

<div class="login-container">
    <h1>Login</h1>
    
    {#if error}
        <div class="error">
            {error}
        </div>
    {/if}
    
    <form method="POST" action="?/login" use:enhance={handleEnhance}>
        <div class="form-group">
            <label for="email">Email</label>
            <input 
                type="email" 
                id="email" 
                name="email" 
                value={email}
                oninput={(e) => email = e.currentTarget.value}
                required
                disabled={isLoading}
            />
        </div>
        
        <div class="form-group">
            <label for="password">Password</label>
            <input 
                type="password" 
                id="password" 
                name="password" 
                value={password}
                oninput={(e) => password = e.currentTarget.value}
                required
                disabled={isLoading}
            />
        </div>
        
        <button type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
        </button>
    </form>
    
    <div class="links">
        <a href="/auth-status">Check Authentication Status</a>
    </div>
</div>

<style>
    .login-container {
        max-width: 400px;
        margin: 0 auto;
        padding: 20px;
        border: 1px solid #ccc;
        border-radius: 5px;
        background-color: #f9f9f9;
    }
    
    h1 {
        text-align: center;
        margin-bottom: 20px;
    }
    
    .form-group {
        margin-bottom: 15px;
    }
    
    label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
    }
    
    input {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
    }
    
    button {
        width: 100%;
        padding: 10px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
    }
    
    button:hover:not(:disabled) {
        background-color: #45a049;
    }
    
    button:disabled {
        background-color: #9e9e9e;
        cursor: not-allowed;
    }
    
    .error {
        background-color: #ffebee;
        color: #c62828;
        padding: 10px;
        margin-bottom: 15px;
        border-radius: 4px;
        border-left: 4px solid #c62828;
    }
    
    .links {
        margin-top: 20px;
        text-align: center;
    }
    
    .links a {
        color: #2196f3;
        text-decoration: none;
    }
    
    .links a:hover {
        text-decoration: underline;
    }
</style> 