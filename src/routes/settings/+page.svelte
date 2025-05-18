<script lang="ts">
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    import { t, language } from '$lib';
    
    // Access page data from server
    let { data } = $props();
    
    // Form state variables
    let profileFormLoading = $state(false);
    let passwordFormLoading = $state(false);
    let profileSuccess = $state('');
    let passwordSuccess = $state('');
    let profileError = $state('');
    let passwordError = $state('');
    
    // Current user data for editing
    let username = $state(data.user?.username || '');
    let email = $state(data.user?.email || '');
    let currentPassword = $state('');
    let newPassword = $state('');
    let confirmPassword = $state('');
    
    // Handle profile update form submission
    const handleProfileUpdate: SubmitFunction = () => {
        profileFormLoading = true;
        profileSuccess = '';
        profileError = '';
        
        return async ({ result }) => {
            profileFormLoading = false;
            
            if (result.type === 'failure') {
                profileError = result.data?.message || t('settings.profile.error', $language);
            } else if (result.type === 'success') {
                profileSuccess = t('settings.profile.success', $language);
            }
        };
    };
    
    // Handle password change form submission
    const handlePasswordChange: SubmitFunction = () => {
        // Form validation
        if (newPassword !== confirmPassword) {
            passwordError = t('settings.password.validationError', $language);
            return;
        }
        
        passwordFormLoading = true;
        passwordSuccess = '';
        passwordError = '';
        
        return async ({ result }) => {
            passwordFormLoading = false;
            
            if (result.type === 'failure') {
                passwordError = result.data?.message || t('settings.password.error', $language);
            } else if (result.type === 'success') {
                passwordSuccess = t('settings.password.success', $language);
                currentPassword = '';
                newPassword = '';
                confirmPassword = '';
            }
        };
    };
</script>

<div class="settings-container">
    <div class="settings-card">
        <h1>{t('settings.title', $language)}</h1>
        
        {#if !data.user}
            <div class="auth-required">
                <p>{t('settings.authRequired', $language)}</p>
                <a href="/login" class="btn primary">{t('settings.login', $language)}</a>
            </div>
        {:else}
            <div class="settings-sections">
                <!-- Profile Information Section -->
                <section class="settings-section">
                    <h2>{t('settings.profile.title', $language)}</h2>
                    
                    {#if profileSuccess}
                        <div class="success-message">
                            {profileSuccess}
                        </div>
                    {/if}
                    
                    {#if profileError}
                        <div class="error-message">
                            {profileError}
                        </div>
                    {/if}
                    
                    <form method="POST" action="?/updateProfile" use:enhance={handleProfileUpdate}>
                        <div class="form-group">
                            <label for="username">{t('settings.profile.username', $language)}</label>
                            <input 
                                type="text" 
                                id="username" 
                                name="username" 
                                value={username}
                                oninput={(e) => username = e.currentTarget.value}
                                disabled={profileFormLoading}
                            />
                        </div>
                        
                        <div class="form-group">
                            <label for="email">{t('settings.profile.email', $language)}</label>
                            <input 
                                type="email" 
                                id="email" 
                                name="email" 
                                value={email}
                                oninput={(e) => email = e.currentTarget.value}
                                disabled={profileFormLoading}
                                readonly
                            />
                            <div class="field-note">{t('settings.profile.emailNote', $language)}</div>
                        </div>
                        
                        <button type="submit" class="btn primary" disabled={profileFormLoading}>
                            {profileFormLoading ? t('settings.profile.updating', $language) : t('settings.profile.updateButton', $language)}
                        </button>
                    </form>
                </section>
                
                <!-- Change Password Section -->
                <section class="settings-section">
                    <h2>{t('settings.password.title', $language)}</h2>
                    
                    {#if passwordSuccess}
                        <div class="success-message">
                            {passwordSuccess}
                        </div>
                    {/if}
                    
                    {#if passwordError}
                        <div class="error-message">
                            {passwordError}
                        </div>
                    {/if}
                    
                    <form method="POST" action="?/changePassword" use:enhance={handlePasswordChange}>
                        <div class="form-group">
                            <label for="currentPassword">{t('settings.password.current', $language)}</label>
                            <input 
                                type="password" 
                                id="currentPassword" 
                                name="currentPassword" 
                                value={currentPassword}
                                oninput={(e) => currentPassword = e.currentTarget.value}
                                required
                                disabled={passwordFormLoading}
                            />
                        </div>
                        
                        <div class="form-group">
                            <label for="newPassword">{t('settings.password.new', $language)}</label>
                            <input 
                                type="password" 
                                id="newPassword" 
                                name="newPassword" 
                                value={newPassword}
                                oninput={(e) => newPassword = e.currentTarget.value}
                                required
                                minlength="8"
                                disabled={passwordFormLoading}
                            />
                            <div class="field-note">{t('settings.password.passwordNote', $language)}</div>
                        </div>
                        
                        <div class="form-group">
                            <label for="confirmPassword">{t('settings.password.confirm', $language)}</label>
                            <input 
                                type="password" 
                                id="confirmPassword" 
                                name="confirmPassword" 
                                value={confirmPassword}
                                oninput={(e) => confirmPassword = e.currentTarget.value}
                                required
                                disabled={passwordFormLoading}
                            />
                        </div>
                        
                        <button type="submit" class="btn primary" disabled={passwordFormLoading}>
                            {passwordFormLoading ? t('settings.password.changing', $language) : t('settings.password.changeButton', $language)}
                        </button>
                    </form>
                </section>
            </div>
        {/if}
    </div>
</div>

<style>
    .settings-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 2rem 0;
    }
    
    .settings-card {
        max-width: 650px;
        width: 100%;
        padding: 2rem;
        border-radius: 0.5rem;
        background-color: #252538;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        animation: fadeIn 0.3s ease-out;
        margin: 0 1rem;
        overflow: auto;
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    h1 {
        text-align: center;
        margin-top: 0;
        margin-bottom: 1.5rem;
        color: #e2e8f0;
        border-bottom: 1px solid #3a3a4f;
        padding-bottom: 1rem;
        font-size: 1.8rem;
    }
    
    h2 {
        color: #e2e8f0;
        margin-top: 0;
        margin-bottom: 1rem;
        font-size: 1.3rem;
        border-bottom: 1px solid #3a3a4f;
        padding-bottom: 0.5rem;
    }
    
    .settings-sections {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }
    
    .settings-section {
        background-color: #1e1e2e;
        padding: 1.5rem;
        border-radius: 0.375rem;
        border: 1px solid #3a3a4f;
    }
    
    .form-group {
        margin-bottom: 1.25rem;
    }
    
    label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #e2e8f0;
    }
    
    input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #4b5563;
        border-radius: 0.375rem;
        background-color: #1e1e2e;
        color: #e2e8f0;
        font-size: 0.95rem;
        box-sizing: border-box;
    }
    
    input:focus {
        border-color: #38bdf8;
        outline: none;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }
    
    input:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    input[readonly] {
        background-color: #2a2a3c;
        cursor: not-allowed;
    }
    
    .field-note {
        font-size: 0.8rem;
        color: #94a3b8;
        margin-top: 0.25rem;
    }
    
    .success-message {
        background-color: rgba(16, 185, 129, 0.1);
        color: #10b981;
        padding: 0.75rem;
        margin-bottom: 1rem;
        border-radius: 0.375rem;
        border-left: 4px solid #10b981;
    }
    
    .error-message {
        background-color: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        padding: 0.75rem;
        margin-bottom: 1rem;
        border-radius: 0.375rem;
        border-left: 4px solid #ef4444;
    }
    
    .btn {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        background-color: #4b5563;
        color: white;
        text-decoration: none;
        border-radius: 0.375rem;
        font-weight: 500;
        border: none;
        cursor: pointer;
        font-size: 0.95rem;
        transition: all 0.2s;
    }
    
    .btn:hover:not(:disabled) {
        background-color: #374151;
        transform: translateY(-2px);
    }
    
    .btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    .btn.primary {
        background-color: #2563eb;
    }
    
    .btn.primary:hover:not(:disabled) {
        background-color: #1d4ed8;
    }
    
    .actions {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-top: 1rem;
    }
    
    .auth-required {
        text-align: center;
        padding: 2rem;
    }
    
    .auth-required p {
        color: #e2e8f0;
        margin-bottom: 1.5rem;
        font-size: 1.1rem;
    }
</style> 