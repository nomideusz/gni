<script lang="ts">
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import Loader from 'lucide-svelte/icons/loader';
    import { t, language } from '$lib';
    
    // Form state variables
    let password = $state('');
    let passwordConfirm = $state('');
    let isLoading = $state(false);
    let error = $state('');
    let success = $state(false);
    
    // Get token from URL
    let token = $derived($page.url.searchParams.get('token') || '');
    
    // Form validation
    let passwordError = $state('');
    let passwordConfirmError = $state('');
    
    function validateForm() {
        passwordError = '';
        passwordConfirmError = '';
        
        let isValid = true;
        
        if (!password) {
            passwordError = t('resetPassword.validation.passwordRequired', $language);
            isValid = false;
        } else if (password.length < 8) {
            passwordError = t('resetPassword.validation.passwordLength', $language);
            isValid = false;
        }
        
        if (!passwordConfirm) {
            passwordConfirmError = t('resetPassword.validation.confirmRequired', $language);
            isValid = false;
        } else if (password !== passwordConfirm) {
            passwordConfirmError = t('resetPassword.validation.passwordsDoNotMatch', $language);
            isValid = false;
        }
        
        return isValid;
    }
    
    // Handle form submission
    const handleSubmit: SubmitFunction = () => {
        // Client-side validation
        if (!validateForm()) {
            return;
        }
        
        isLoading = true;
        error = '';
        
        return async ({ result }) => {
            isLoading = false;
            
            if (result.type === 'failure') {
                error = result.data?.message || t('resetPassword.error', $language);
            } else if (result.type === 'success') {
                success = true;
            }
        };
    };
    
    function goToLogin() {
        goto('/login');
    }
</script>

<div class="fullscreen">
    <div class="auth__card {isLoading ? 'is-loading' : ''}">
        <h1 class="auth__title">{t('resetPassword.title', $language)}</h1>
        
        {#if !token}
            <div class="error">
                <p>{t('resetPassword.invalidToken', $language)}</p>
                <div class="button-container">
                    <a href="/forgot-password" class="button button--primary">{t('resetPassword.requestNewLink', $language)}</a>
                </div>
            </div>
        {:else if success}
            <div class="success">
                <p>{t('resetPassword.success', $language)}</p>
                <button class="button button--primary" onclick={goToLogin}>{t('resetPassword.goToLogin', $language)}</button>
            </div>
        {:else}
            <p class="description">
                {t('resetPassword.description', $language)}
            </p>
            
            {#if error}
                <div class="error">
                    {error}
                </div>
            {/if}
            
            <form method="POST" novalidate use:enhance={handleSubmit} class="form">
                <input type="hidden" name="token" value={token} />
                
                <div class="form__group">
                    <label for="password" class="form__label">{t('resetPassword.newPassword', $language)}</label>
                    <input 
                        type="password" 
                        id="password" 
                        name="password"
                        placeholder={t('resetPassword.newPasswordPlaceholder', $language)}
                        value={password}
                        oninput={(e) => password = e.currentTarget.value}
                        onblur={() => {
                            if (!password) passwordError = t('resetPassword.validation.passwordRequired', $language);
                            else if (password.length < 8) passwordError = t('resetPassword.validation.passwordLength', $language);
                            else passwordError = '';
                        }}
                        class="form__input {passwordError ? 'form__input--error' : ''}"
                        required
                        minlength="8"
                        disabled={isLoading}
                    />
                    {#if passwordError}
                        <p class="form__error">{passwordError}</p>
                    {:else}
                        <p class="form__note">{t('resetPassword.passwordNote', $language)}</p>
                    {/if}
                </div>
                
                <div class="form__group">
                    <label for="passwordConfirm" class="form__label">{t('resetPassword.confirmPassword', $language)}</label>
                    <input 
                        type="password" 
                        id="passwordConfirm" 
                        name="passwordConfirm"
                        placeholder={t('resetPassword.confirmPasswordPlaceholder', $language)}
                        value={passwordConfirm}
                        oninput={(e) => passwordConfirm = e.currentTarget.value}
                        onblur={() => {
                            if (!passwordConfirm) passwordConfirmError = t('resetPassword.validation.confirmRequired', $language);
                            else if (password !== passwordConfirm) passwordConfirmError = t('resetPassword.validation.passwordsDoNotMatch', $language);
                            else passwordConfirmError = '';
                        }}
                        class="form__input {passwordConfirmError ? 'form__input--error' : ''}"
                        required
                        disabled={isLoading}
                    />
                    {#if passwordConfirmError}
                        <p class="form__error">{passwordConfirmError}</p>
                    {/if}
                </div>
                
                <button 
                    type="submit" 
                    class="button button--primary button--full-width button--gap" 
                    disabled={isLoading}
                    onclick={(e) => {
                        if (!validateForm()) {
                            e.preventDefault();
                        }
                    }}
                >
                    {#if isLoading}
                        <span class="button__spinner"><Loader size={16} /></span>
                        <span>{t('resetPassword.settingPassword', $language)}</span>
                    {:else}
                        {t('resetPassword.setPasswordButton', $language)}
                    {/if}
                </button>
            </form>
            
            <div class="links">
                <a href="/login" class="links__item">{t('resetPassword.backToLogin', $language)}</a>
            </div>
        {/if}
        
        {#if isLoading}
            <div class="loader-container">
                <Loader size={28} class="loader-icon" />
                <span class="loader-text">{t('resetPassword.pleaseWait', $language)}</span>
            </div>
        {/if}
    </div>
</div>

<style>
    .fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background-color: #1e1e2e;
        z-index: 100;
    }

    /* Card container for auth forms */
    .auth__card {
        position: relative;
        width: 100%;
        max-width: 400px;
        background-color: #252538;
        border-radius: 0.5rem;
        padding: 2.25rem;
        margin: 0 1rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        animation: fadeIn 0.3s ease-out;
        text-align: center;
        overflow: hidden;
        transition: all 0.3s ease;
    }

    /* Fade-in animation */
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

    .auth__title {
        margin: 0 0 2rem 0;
        color: #e2e8f0;
        font-size: 2rem;
        font-weight: 600;
    }

    .description {
        text-align: center;
        margin-bottom: 1.5rem;
        color: #94a3b8;
        font-size: 0.95rem;
        line-height: 1.5;
    }

    /* Form block and elements */
    .form {
        width: 100%;
        margin-top: 0.5rem;
    }

    .form__group {
        margin-bottom: 1.25rem;
        text-align: left;
    }

    .form__label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #e2e8f0;
        font-size: 0.95rem;
    }

    .form__input {
        width: 100%;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.375rem;
        box-sizing: border-box;
        background-color: rgba(0, 0, 0, 0.2);
        color: #e2e8f0;
        font-size: 0.95rem;
        transition: all 0.2s ease;
    }

    .form__input:focus {
        border-color: #38bdf8;
        outline: none;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
    }
    
    .form__input--error {
        border-color: #ef4444;
        box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2);
    }
    
    .form__input--error:focus {
        border-color: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
    }

    .form__input::placeholder {
        color: rgba(226, 232, 240, 0.5);
    }
    
    .form__input:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    .form__error {
        color: #ef4444;
        font-size: 0.8rem;
        margin: 6px 0 0 0;
        padding: 0;
    }
    
    .form__note {
        font-size: 0.8rem;
        color: #94a3b8;
        margin: 6px 0 0 0;
        padding: 0;
    }

    /* Button styles */
    .button {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        color: white;
        text-decoration: none;
        border-radius: 0.375rem;
        font-weight: 500;
        border: none;
        cursor: pointer;
        font-size: 0.95rem;
        transition: all 0.2s;
    }
    
    .button--primary {
        background-color: #2563eb;
    }
    
    .button--primary:hover:not(:disabled) {
        background-color: #1d4ed8;
        transform: translateY(-2px);
    }
    
    .button--full-width {
        width: 100%;
    }
    
    .button--gap {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
    }
    
    .button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    
    .button__spinner {
        display: inline-flex;
    }
    
    .button-container {
        margin-top: 1rem;
    }

    /* Links block */
    .links {
        margin-top: 2rem;
        text-align: center;
    }

    .links__item {
        color: #38bdf8;
        text-decoration: none;
        font-size: 0.9rem;
        transition: color 0.2s ease;
    }

    .links__item:hover {
        color: #0ea5e9;
        text-decoration: underline;
    }

    /* Error block */
    .error {
        background-color: rgba(239, 68, 68, 0.15);
        color: #f87171;
        padding: 12px 14px;
        margin: 1rem 0 1.5rem;
        border-radius: 0.375rem;
        border-left: 4px solid #ef4444;
        font-size: 0.9rem;
        text-align: left;
    }
    
    /* Success block */
    .success {
        background-color: rgba(16, 185, 129, 0.1);
        color: #10b981;
        padding: 1rem;
        margin-bottom: 1.5rem;
        border-radius: 0.375rem;
        border-left: 4px solid #10b981;
        text-align: center;
    }
    
    .success p {
        margin-bottom: 1rem;
    }

    /* Loading states */
    .is-loading {
        position: relative;
    }

    .is-loading::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        border-radius: 0.5rem;
        z-index: 10;
        backdrop-filter: blur(2px);
    }

    .loader-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 20;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #e2e8f0;
    }

    :global(.loader-icon) {
        animation: spin 1s linear infinite;
        margin-bottom: 8px;
        color: #38bdf8;
    }

    .loader-text {
        font-size: 0.9rem;
        font-weight: 500;
        letter-spacing: 0.5px;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style> 