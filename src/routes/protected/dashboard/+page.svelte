<script>
    import { page } from '$app/stores';
    import LogoutButton from '../../../components/LogoutButton.svelte';
</script>

<div class="dashboard">
    <header>
        <h1>Dashboard</h1>
        <div class="user-info">
            <span>Welcome, {$page.data.user.name || $page.data.user.email}</span>
            <LogoutButton />
        </div>
    </header>
    
    <main>
        <div class="card">
            <h2>Your Account</h2>
            <p>Email: {$page.data.user.email}</p>
            <p>ID: {$page.data.user.id}</p>
            <p>Created: {new Date($page.data.user.created).toLocaleDateString()}</p>
        </div>
    </main>
</div>

<style>
    .dashboard {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
    }
    
    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
    }
    
    .user-info {
        display: flex;
        align-items: center;
        gap: 15px;
    }
    
    .card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    h1 {
        margin: 0;
        color: #333;
    }
    
    h2 {
        margin-top: 0;
        color: #444;
    }
</style> 