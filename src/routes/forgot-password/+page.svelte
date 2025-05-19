<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import Loader from 'lucide-svelte/icons/loader';
	import { t, language } from '$lib';

	// Form state variables
	let email = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let success = $state('');

	// Handle form submission
	const handleSubmit: SubmitFunction = () => {
		isLoading = true;
		error = '';
		success = '';

		return async ({ result }) => {
			isLoading = false;

			if (result.type === 'failure') {
				error = result.data?.message || 'Failed to send password reset email';
			} else if (result.type === 'success') {
				success = t('forgotPassword.success', $language);
				email = ''; // Clear the form
			}
		};
	};

	function goToLogin() {
		goto('/login');
	}

	// Form validation
	let emailError = $state('');

	function validateEmail() {
		if (!email) {
			emailError = t('forgotPassword.validation.emailRequired', $language);
			return false;
		} else if (!/^\S+@\S+\.\S+$/.test(email)) {
			emailError = t('forgotPassword.validation.emailInvalid', $language);
			return false;
		}
		emailError = '';
		return true;
	}
</script>

<div class="fullscreen">
	<div class="card {isLoading ? 'is-loading' : ''}">
		<h1 class="card__title">{t('forgotPassword.title', $language)}</h1>

		{#if success}
			<div class="message message--success">
				<p>{success}</p>
				<button class="button button--primary" onclick={goToLogin}
					>{t('forgotPassword.returnToLogin', $language)}</button
				>
			</div>
		{:else}
			<p class="description">
				{t('forgotPassword.description', $language)}
			</p>

			{#if error}
				<div class="message message--error">
					{error}
				</div>
			{/if}

			<form method="POST" novalidate use:enhance={handleSubmit} class="form">
				<div class="form__group">
					<label for="email" class="form__label">{t('forgotPassword.emailLabel', $language)}</label>
					<input
						type="email"
						id="email"
						name="email"
						placeholder={t('forgotPassword.emailPlaceholder', $language)}
						value={email}
						oninput={(e) => (email = e.currentTarget.value)}
						onblur={() => validateEmail()}
						class="form__input {emailError ? 'form__input--error' : ''}"
						required
						disabled={isLoading}
					/>
					{#if emailError}
						<p class="form__error">{emailError}</p>
					{/if}
				</div>

				<button
					type="submit"
					class="button button--primary button--full-width button--gap"
					disabled={isLoading}
					onclick={(e) => {
						if (!validateEmail()) {
							e.preventDefault();
						}
					}}
				>
					{#if isLoading}
						<span class="button__spinner"><Loader size={16} /></span>
						<span>{t('forgotPassword.sending', $language)}</span>
					{:else}
						{t('forgotPassword.sendButton', $language)}
					{/if}
				</button>
			</form>

			<div class="links">
				<a href="/login" class="links__item">{t('forgotPassword.backToLogin', $language)}</a>
			</div>
		{/if}

		{#if isLoading}
			<div class="loader-container">
				<Loader size={28} class="loader-icon" />
				<span class="loader-text">{t('forgotPassword.pleaseWait', $language)}</span>
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
