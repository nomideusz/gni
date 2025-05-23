<script lang="ts">
	import { enhance } from '$app/forms';
	import { authState } from '$lib/auth';
	import Loader from 'lucide-svelte/icons/loader';
	import { t, language } from '$lib';
	import AuthForm from '$lib/components/AuthForm.svelte';

	// Define the type for our form data
	type LoginForm = {
		email?: string;
		error?: string;
		success?: boolean;
	};

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
</script>

<AuthForm 
	title={t('loginPage.title', $language)}
	error={form?.error || ''}
	loading={isLoggingIn || manualLoading}
>
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
					else if (!/^\S+@\S+\.\S+$/.test(email))
						emailError = t('loginPage.validation.emailInvalid', $language);
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
</AuthForm>

<style>
	.submit-button {
		margin-top: 1.5rem;
	}
</style> 