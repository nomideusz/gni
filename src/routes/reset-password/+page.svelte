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
	<div class="card {isLoading ? 'is-loading' : ''}">
		<h1 class="card__title">{t('resetPassword.title', $language)}</h1>

		{#if !token}
			<div class="message message--error">
				<p>{t('resetPassword.invalidToken', $language)}</p>
				<div class="button-container">
					<a href="/forgot-password" class="button button--primary"
						>{t('resetPassword.requestNewLink', $language)}</a
					>
				</div>
			</div>
		{:else if success}
			<div class="message message--success">
				<p>{t('resetPassword.success', $language)}</p>
				<button class="button button--primary" onclick={goToLogin}
					>{t('resetPassword.goToLogin', $language)}</button
				>
			</div>
		{:else}
			<p class="description">
				{t('resetPassword.description', $language)}
			</p>

			{#if error}
				<div class="message message--error">
					{error}
				</div>
			{/if}

			<form method="POST" novalidate use:enhance={handleSubmit} class="form">
				<input type="hidden" name="token" value={token} />

				<div class="form__group">
					<label for="password" class="form__label"
						>{t('resetPassword.newPassword', $language)}</label
					>
					<input
						type="password"
						id="password"
						name="password"
						placeholder={t('resetPassword.newPasswordPlaceholder', $language)}
						value={password}
						oninput={(e) => (password = e.currentTarget.value)}
						onblur={() => {
							if (!password)
								passwordError = t('resetPassword.validation.passwordRequired', $language);
							else if (password.length < 8)
								passwordError = t('resetPassword.validation.passwordLength', $language);
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
					<label for="passwordConfirm" class="form__label"
						>{t('resetPassword.confirmPassword', $language)}</label
					>
					<input
						type="password"
						id="passwordConfirm"
						name="passwordConfirm"
						placeholder={t('resetPassword.confirmPasswordPlaceholder', $language)}
						value={passwordConfirm}
						oninput={(e) => (passwordConfirm = e.currentTarget.value)}
						onblur={() => {
							if (!passwordConfirm)
								passwordConfirmError = t('resetPassword.validation.confirmRequired', $language);
							else if (password !== passwordConfirm)
								passwordConfirmError = t('resetPassword.validation.passwordsDoNotMatch', $language);
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
		background-color: var(--bg-primary);
		z-index: 100;
	}
	.links {
		margin-top: 2rem;
		text-align: center;
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
		color: var(--text-primary);
	}
	:global(.loader-icon) {
		animation: spin 1s linear infinite;
		margin-bottom: 8px;
		color: var(--accent-primary);
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
