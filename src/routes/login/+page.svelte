<script lang="ts">
	import { enhance } from '$app/forms';
	import { authState } from '$lib/auth';
	import Loader from 'lucide-svelte/icons/loader';
	import { t, language } from '$lib';
	
	// Define the type for our form data
	type LoginForm = {
		email?: string;
		error?: string;
		success?: boolean;
	}
	
	let { form } = $props<{ form?: LoginForm }>();

	// Destructure the auth state for reactivity
	const isLoggingIn = $derived($authState === 'loggingIn');
	let manualLoading = $state(false);

	// Form data - use server-returned values if available
	let email = $state(form?.email || '');
	let password = $state(''); // Don't restore password for security reasons
	
	// Form validation
	let emailError = $state('');
	let passwordError = $state('');
	
	// Validate form inputs
	function validateForm() {
		// Reset errors
		emailError = '';
		passwordError = '';
		
		let isValid = true;
		
		// Email validation
		if (!email) {
			emailError = t('loginPage.validation.emailRequired', $language);
			isValid = false;
		} else if (!/^\S+@\S+\.\S+$/.test(email)) {
			emailError = t('loginPage.validation.emailInvalid', $language);
			isValid = false;
		}
		
		// Password validation
		if (!password) {
			passwordError = t('loginPage.validation.passwordRequired', $language);
			isValid = false;
		}
		
		return isValid;
	}

	// Let's log the state when it changes for debugging
	$effect(() => {
		console.log('Auth state:', $authState);
		console.log('Is logging in:', isLoggingIn);
	});
</script>

<div class="fullscreen">
	<div class="auth__card {isLoggingIn || manualLoading ? 'is-loading' : ''}">
		<h1 class="auth__title">{t('loginPage.title', $language)}</h1>

		{#if form?.error}
			<div class="error">
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			novalidate
			use:enhance={({ formData, cancel }) => {
				// Run client-side validation first
				if (!validateForm()) {
					// Cancel form submission if validation fails
					cancel();
					return;
				}
				
				manualLoading = true;
				// Store the current email for reference
				const submittedEmail = formData.get('email') as string;

				return async ({ update }) => {
					await update({ reset: false }); // Prevent form reset to keep values
					// Update local email value in case server returned a different one
					if (form?.email) {
						email = form.email;
					} else {
						email = submittedEmail;
					}
					setTimeout(() => {
						manualLoading = false;
					}, 500);
				};
			}}
			class="form"
		>
			<div class="form__group">
				<label for="email" class="form__label">{t('loginPage.email', $language)}</label>
				<input
					type="email"
					id="email"
					name="email"
					bind:value={email}
					class="form__input {emailError ? 'form__input--error' : ''}"
					placeholder={t('loginPage.emailPlaceholder', $language)}
					disabled={isLoggingIn || manualLoading}
					onblur={() => {
						if (!email) emailError = t('loginPage.validation.emailRequired', $language);
						else if (!/^\S+@\S+\.\S+$/.test(email)) emailError = t('loginPage.validation.emailInvalid', $language);
						else emailError = '';
					}}
				/>
				{#if emailError}
					<p class="form__error">{emailError}</p>
				{/if}
			</div>

			<div class="form__group">
				<label for="password" class="form__label">{t('loginPage.password', $language)}</label>
				<input
					type="password"
					id="password"
					name="password"
					bind:value={password}
					class="form__input {passwordError ? 'form__input--error' : ''}"
					placeholder={t('loginPage.passwordPlaceholder', $language)}
					disabled={isLoggingIn || manualLoading}
					onblur={() => {
						if (!password) passwordError = t('loginPage.validation.passwordRequired', $language);
						else passwordError = '';
					}}
				/>
				{#if passwordError}
					<p class="form__error">{passwordError}</p>
				{/if}
			</div>

			<button 
				type="submit" 
				class="button button--primary button--full-width button--gap submit-button" 
				disabled={isLoggingIn || manualLoading}
				onclick={(e) => {
					if (!validateForm()) {
						e.preventDefault();
					}
				}}
			>
				{#if isLoggingIn || manualLoading}
					<span class="button__spinner"><Loader size={16} /></span>
					<span>{t('loginPage.loggingIn', $language)}</span>
				{:else}
					{t('loginPage.loginButton', $language)}
				{/if}
			</button>
		</form>

		<div class="links">
			<a href="/forgot-password" class="links__item">{t('loginPage.forgotPassword', $language)}</a>
		</div>
		
		{#if isLoggingIn || manualLoading}
			<div class="loader-container">
				<Loader size={28} class="loader-icon" />
				<span class="loader-text">{t('loginPage.pleaseWait', $language)}</span>
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
