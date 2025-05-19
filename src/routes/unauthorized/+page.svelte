<script>
    import { goto } from '$app/navigation';
</script>

<div class="unauthorized-container">
    <div class="error-box">
        <h1>Unauthorized Access</h1>
        <p>You don't have permission to access this page. This feature requires administrator privileges.</p>
        <button on:click={() => goto('/')}>Return to Home</button>
    </div>
</div>

<style>
    .unauthorized-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background-color: #f8f9fa;
    }

    .error-box {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        padding: 2rem;
        text-align: center;
        max-width: 500px;
    }

    h1 {
        color: #dc3545;
        margin-bottom: 1rem;
    }

    p {
        margin-bottom: 2rem;
        color: #6c757d;
    }

    button {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    button:hover {
        background-color: #0069d9;
    }
</style> 