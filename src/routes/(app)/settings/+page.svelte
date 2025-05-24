<svelte:options runes={true} />

<script lang="ts">
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    import { t, language } from '$lib';
    import PageTemplate from '$lib/components/PageTemplate.svelte';
    import '$lib/styles/settings.css';
    // Import Lucide icons
    import User from 'lucide-svelte/icons/user';
    import Lock from 'lucide-svelte/icons/lock';
    import Check from 'lucide-svelte/icons/check';
    import AlertCircle from 'lucide-svelte/icons/alert-circle';
    
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

<PageTemplate 
    title={t('settings.title', $language)}
    showActions={false}
    footer={false}
>
    {#snippet content()}
        <div class="settings-page">
        {#if !data.user}
                <div class="settings-info-card">
                <p>{t('settings.authRequired', $language)}</p>
                <a href="/login" class="button button--primary">{t('settings.login', $language)}</a>
            </div>
        {:else}
                <div class="settings-sections">
                    <!-- Profile Settings Card -->
                    <div class="settings-card">
                        <header class="settings-card__header">
                            <h2 class="settings-card__title">
                                <span class="settings-card__icon">
                                    <User size={18} />
                                </span>
                                {t('settings.profile.title', $language)}
                            </h2>
                        </header>
                        
                    {#if profileSuccess}
                            <div class="settings-message settings-message--success">
                                <Check size={20} class="settings-message__icon" />
                            {profileSuccess}
                        </div>
                    {/if}
                    
                    {#if profileError}
                            <div class="settings-message settings-message--error">
                                <AlertCircle size={20} class="settings-message__icon" />
                            {profileError}
                        </div>
                    {/if}
                    
                        <form method="POST" action="?/updateProfile" use:enhance={handleProfileUpdate} class="settings-form">
                            <div class="settings-form__group">
                                <label for="username" class="settings-form__label">{t('settings.profile.username', $language)}</label>
                            <input 
                                type="text" 
                                id="username" 
                                name="username" 
                                value={username}
                                oninput={(e) => username = e.currentTarget.value}
                                disabled={profileFormLoading}
                                    class="settings-form__input"
                            />
                        </div>
                        
                            <div class="settings-form__group">
                                <label for="email" class="settings-form__label">{t('settings.profile.email', $language)}</label>
                            <input 
                                type="email" 
                                id="email" 
                                name="email" 
                                value={email}
                                oninput={(e) => email = e.currentTarget.value}
                                disabled={profileFormLoading}
                                readonly
                                    class="settings-form__input"
                            />
                                <p class="settings-form__note">{t('settings.profile.emailNote', $language)}</p>
                        </div>
                        
                            <button type="submit" class="button button--primary settings-form__button" disabled={profileFormLoading}>
                            {profileFormLoading ? t('settings.profile.updating', $language) : t('settings.profile.updateButton', $language)}
                        </button>
                    </form>
                    </div>
                    
                    <!-- Password Settings Card -->
                    <div class="settings-card">
                        <header class="settings-card__header">
                            <h2 class="settings-card__title">
                                <span class="settings-card__icon">
                                    <Lock size={18} />
                                </span>
                                {t('settings.password.title', $language)}
                            </h2>
                        </header>
                        
                    {#if passwordSuccess}
                            <div class="settings-message settings-message--success">
                                <Check size={20} class="settings-message__icon" />
                            {passwordSuccess}
                        </div>
                    {/if}
                    
                    {#if passwordError}
                            <div class="settings-message settings-message--error">
                                <AlertCircle size={20} class="settings-message__icon" />
                            {passwordError}
                        </div>
                    {/if}
                    
                        <form method="POST" action="?/changePassword" use:enhance={handlePasswordChange} class="settings-form">
                            <div class="settings-form__group">
                                <label for="currentPassword" class="settings-form__label">{t('settings.password.current', $language)}</label>
                            <input 
                                type="password" 
                                id="currentPassword" 
                                name="currentPassword" 
                                value={currentPassword}
                                oninput={(e) => currentPassword = e.currentTarget.value}
                                required
                                disabled={passwordFormLoading}
                                    class="settings-form__input"
                            />
                        </div>
                        
                            <div class="settings-form__group">
                                <label for="newPassword" class="settings-form__label">{t('settings.password.new', $language)}</label>
                            <input 
                                type="password" 
                                id="newPassword" 
                                name="newPassword" 
                                value={newPassword}
                                oninput={(e) => newPassword = e.currentTarget.value}
                                required
                                minlength="8"
                                disabled={passwordFormLoading}
                                    class="settings-form__input"
                            />
                                <p class="settings-form__note">{t('settings.password.passwordNote', $language)}</p>
                        </div>
                        
                            <div class="settings-form__group">
                                <label for="confirmPassword" class="settings-form__label">{t('settings.password.confirm', $language)}</label>
                            <input 
                                type="password" 
                                id="confirmPassword" 
                                name="confirmPassword" 
                                value={confirmPassword}
                                oninput={(e) => confirmPassword = e.currentTarget.value}
                                required
                                disabled={passwordFormLoading}
                                    class="settings-form__input"
                            />
                        </div>
                        
                            <button type="submit" class="button button--primary settings-form__button" disabled={passwordFormLoading}>
                            {passwordFormLoading ? t('settings.password.changing', $language) : t('settings.password.changeButton', $language)}
                        </button>
                    </form>
                    </div>
                </div>
        {/if}
        </div>
    {/snippet}
</PageTemplate>

 