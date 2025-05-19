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
    
    // Handle profile update submission
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
    
    // Handle password change submission
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

<div class="page-content">
    <div class="page-header">
        <h1 class="page-header__title">{t('settings.title', $language)}</h1>
    </div>
    
    {#if !data.user}
        <div class="info-card">
            <p>{t('settings.authRequired', $language)}</p>
            <a href="/login" class="button button--primary">{t('settings.login', $language)}</a>
        </div>
    {:else}
        <div class="content-container">
            <!-- Profile Information Section -->
            <section class="settings-section">
                <h2 class="settings-section__title">{t('settings.profile.title', $language)}</h2>
                
                {#if profileSuccess}
                    <div class="message message--success">
                        {profileSuccess}
                    </div>
                {/if}
                
                {#if profileError}
                    <div class="message message--error">
                        {profileError}
                    </div>
                {/if}
                
                <form method="POST" action="?/updateProfile" use:enhance={handleProfileUpdate} class="form">
                    <div class="form__group">
                        <label for="username" class="form__label">{t('settings.profile.username', $language)}</label>
                        <input 
                            type="text" 
                            id="username" 
                            name="username" 
                            value={username}
                            oninput={(e) => username = e.currentTarget.value}
                            disabled={profileFormLoading}
                            class="form__input"
                        />
                    </div>
                    
                    <div class="form__group">
                        <label for="email" class="form__label">{t('settings.profile.email', $language)}</label>
                        <input 
                            type="email" 
                            id="email" 
                            name="email" 
                            value={email}
                            oninput={(e) => email = e.currentTarget.value}
                            disabled={profileFormLoading}
                            readonly
                            class="form__input"
                        />
                        <p class="form__note">{t('settings.profile.emailNote', $language)}</p>
                    </div>
                    
                    <button type="submit" class="button button--primary" disabled={profileFormLoading}>
                        {profileFormLoading ? t('settings.profile.updating', $language) : t('settings.profile.updateButton', $language)}
                    </button>
                </form>
            </section>
            
            <!-- Change Password Section -->
            <section class="settings-section">
                <h2 class="settings-section__title">{t('settings.password.title', $language)}</h2>
                
                {#if passwordSuccess}
                    <div class="message message--success">
                        {passwordSuccess}
                    </div>
                {/if}
                
                {#if passwordError}
                    <div class="message message--error">
                        {passwordError}
                    </div>
                {/if}
                
                <form method="POST" action="?/changePassword" use:enhance={handlePasswordChange} class="form">
                    <div class="form__group">
                        <label for="currentPassword" class="form__label">{t('settings.password.current', $language)}</label>
                        <input 
                            type="password" 
                            id="currentPassword" 
                            name="currentPassword" 
                            value={currentPassword}
                            oninput={(e) => currentPassword = e.currentTarget.value}
                            required
                            disabled={passwordFormLoading}
                            class="form__input"
                        />
                    </div>
                    
                    <div class="form__group">
                        <label for="newPassword" class="form__label">{t('settings.password.new', $language)}</label>
                        <input 
                            type="password" 
                            id="newPassword" 
                            name="newPassword" 
                            value={newPassword}
                            oninput={(e) => newPassword = e.currentTarget.value}
                            required
                            minlength="8"
                            disabled={passwordFormLoading}
                            class="form__input"
                        />
                        <p class="form__note">{t('settings.password.passwordNote', $language)}</p>
                    </div>
                    
                    <div class="form__group">
                        <label for="confirmPassword" class="form__label">{t('settings.password.confirm', $language)}</label>
                        <input 
                            type="password" 
                            id="confirmPassword" 
                            name="confirmPassword" 
                            value={confirmPassword}
                            oninput={(e) => confirmPassword = e.currentTarget.value}
                            required
                            disabled={passwordFormLoading}
                            class="form__input"
                        />
                    </div>
                    
                    <button type="submit" class="button button--primary" disabled={passwordFormLoading}>
                        {passwordFormLoading ? t('settings.password.changing', $language) : t('settings.password.changeButton', $language)}
                    </button>
                </form>
            </section>
        </div>
    {/if}
</div>

<style>
    /* Use the page-content class from the global styles */
    /* No need to redefine it as it's already in ui-components.css */
    
    .content-container {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        align-items: flex-start;
    }
    
    .settings-section {
        background-color: var(--bg-secondary);
        padding: 1.5rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-primary);
        box-shadow: var(--shadow-sm);
        transition: box-shadow var(--transition-fast);
        width: 100%;
        max-width: 600px;
    }
    
    .settings-section:hover {
        box-shadow: var(--shadow-md);
    }
    
    .settings-section__title {
        color: var(--text-primary);
        margin: 0 0 1.2rem 0;
        font-size: 1.2rem;
        font-weight: 600;
        border-bottom: 1px solid var(--border-primary);
        padding-bottom: 0.5rem;
        text-align: left;
    }
    
    /* Override form elements to ensure they're left-aligned */
    :global(.form) {
        text-align: left;
    }
    
    :global(.form__note) {
        text-align: left;
    }
    
    :global(.form__label) {
        text-align: left;
    }
    
    :global(.message) {
        text-align: left;
    }
    
    @media (min-width: 768px) {
        .content-container {
            flex-direction: column;
        }
    }
</style> 