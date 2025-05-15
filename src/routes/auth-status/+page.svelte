<script lang="ts">
    let { data } = $props();
</script>

<div class="auth-status">
    <h1>Authentication Status</h1>
    
    <div class="status-box">
        <h2>Login Status</h2>
        <p class={data.isAuthenticated ? "status-success" : "status-error"}>
            {data.isAuthenticated ? "Authenticated ✓" : "Not Authenticated ✗"}
        </p>
    </div>
    
    {#if data.isAuthenticated && data.user}
        <div class="user-info">
            <h2>User Information</h2>
            <ul>
                <li><strong>ID:</strong> {data.user.id}</li>
                <li><strong>Email:</strong> {data.user.email}</li>
                <li><strong>Username:</strong> {data.user.username || 'N/A'}</li>
                {#if data.user.created}
                    <li><strong>Created:</strong> {new Date(data.user.created).toLocaleString()}</li>
                {/if}
                {#if data.user.updated}
                    <li><strong>Updated:</strong> {new Date(data.user.updated).toLocaleString()}</li>
                {/if}
            </ul>
        </div>
    {/if}
    
    <div class="auth-details">
        <h2>Authentication Details</h2>
        <p><strong>Token Present:</strong> {data.authDetails.token ? 'Yes' : 'No'}</p>
        <p><strong>Auth Model:</strong> {data.authDetails.model}</p>
        {#if data.authDetails.expires}
            <p><strong>Expires:</strong> {new Date(data.authDetails.expires).toLocaleString()}</p>
        {/if}
    </div>
    
    <div class="actions">
        <a href="/" class="btn">Home</a>
        <a href="/login" class="btn">Login Page</a>
        <form action="/logout" method="POST" style="display: inline;">
            <button type="submit" class="btn">Logout</button>
        </form>
    </div>
</div>

<style>
    .auth-status {
        max-width: 800px;
        margin: 2rem auto;
        padding: 2rem;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    h1 {
        text-align: center;
        margin-top: 0;
        color: #333;
        border-bottom: 1px solid #eee;
        padding-bottom: 1rem;
    }
    
    h2 {
        color: #444;
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
        font-size: 1.3rem;
    }
    
    .status-box {
        text-align: center;
        padding: 1rem;
        background-color: #f8f9fa;
        border-radius: 6px;
        margin-bottom: 1.5rem;
    }
    
    .status-success {
        color: #2c7a35;
        font-weight: bold;
        font-size: 1.2rem;
    }
    
    .status-error {
        color: #d32f2f;
        font-weight: bold;
        font-size: 1.2rem;
    }
    
    .user-info, .auth-details {
        background-color: #f8f9fa;
        padding: 1rem 1.5rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
    }
    
    ul {
        list-style-type: none;
        padding-left: 0;
    }
    
    li {
        margin-bottom: 0.5rem;
    }
    
    strong {
        font-weight: 600;
        color: #555;
    }
    
    .actions {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-top: 2rem;
    }
    
    .btn {
        display: inline-block;
        padding: 0.5rem 1rem;
        background-color: #4299e1;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 500;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
    }
    
    .btn:hover {
        background-color: #3182ce;
    }
</style> 