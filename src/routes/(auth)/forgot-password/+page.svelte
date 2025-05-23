<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { goto } from '$app/navigation';
	import Loader from 'lucide-svelte/icons/loader';
	import { t, language } from '$lib';
	import AuthForm from '$lib/components/AuthForm.svelte';

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

<AuthForm 
	title={t('forgotPassword.title', $language)} 
	loading={isLoading}
	error={error}
>
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
</AuthForm>

<style>
	.description {
		margin-bottom: 1.5rem;
		color: var(--text-secondary);
		line-height: 1.5;
		text-align: left;
	}
	
	:global(.message--success) {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1.5rem;
	}
	
	:global(.message--success button) {
		margin-top: 0.5rem;
	}
</style> 