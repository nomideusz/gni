<script lang="ts">
	import '$lib/styles/typography.css';
	import '$lib/styles/theme.css';
	import '$lib/styles/ui-components.css';
	import '$lib/styles/buttons.css';
	import { t, language } from '$lib';
	
	let { children } = $props();
</script>

<svelte:head>
	<title>{t('auth.title', $language)} | {t('appName', $language)}</title>
</svelte:head>

<div class="auth-layout">
	<div class="auth-container">
		{@render children()}
	</div>
	
	<footer class="auth-footer">
		<p>© {new Date().getFullYear()} {t('appName', $language)} | {t('appDescription', $language)}</p>
	</footer>
</div>

<style>
	:global(body),
	:global(html) {
		margin: 0;
		padding: 0;
		height: 100%;
		min-height: 100vh;
		width: 100%;
	}

	.auth-layout {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		height: 100%;
		background-color: var(--bg-secondary);
		padding: 2rem 0;
		box-sizing: border-box;
	}

	.auth-container {
		width: 100%;
		max-width: 480px;
		padding: 2rem;
		border-radius: var(--radius-lg);
		background-color: var(--bg-card);
		box-shadow: var(--shadow-lg);
		border: 1px solid var(--border-primary);
		margin: auto 0;
	}
	
	.auth-footer {
		margin-top: 2rem;
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.85rem;
		opacity: 0.8;
	}

	@media (max-width: 520px) {
		.auth-container {
			max-width: 100%;
			padding: 1.5rem;
			margin: auto 1rem;
		}
	}
</style> 