<script lang="ts">
	let { children, data } = $props();
	import Flame from 'lucide-svelte/icons/flame';
	import BarChart from 'lucide-svelte/icons/bar-chart';
	import Database from 'lucide-svelte/icons/database';
	import Settings from 'lucide-svelte/icons/settings';
	import Table from 'lucide-svelte/icons/table';
	import Users from 'lucide-svelte/icons/users';
	import { language, t, LANGUAGES } from '$lib';
	import { initialUserValue, setupAuthListener, pb } from '$lib/pocketbase';
	import { onDestroy, onMount } from 'svelte';
	import { languageContext, switchLanguage } from '$lib/context';
	import { authFSM, updateAuthState } from '$lib/auth';
	import { page } from '$app/stores';
	
	// Track whether component is mounted to avoid flash of incorrect state
	let mounted = $state(false);
	
	// Create a state for the current user
	let currentUser = $state(initialUserValue || data.user || null);
	
	// Update currentUser with data from server
	$effect(() => {
		if (data.user) {
			console.log('User data from server:', data.user);
			currentUser = data.user;
			updateAuthState(data.user);
		}
	});
	
	// Set component as mounted
	onMount(() => {
		mounted = true;
		return () => {
			mounted = false;
		};
	});
	
	// Set up auth listener to update currentUser
	const cleanup = setupAuthListener((user) => {
		currentUser = user;
		// Update FSM state manually when currentUser changes
		updateAuthState(user);
	});
	
	// Clean up listener on component destruction
	onDestroy(cleanup);
	
	// Get current year for the footer
	const currentYear = new Date().getFullYear();
	
	// Set language context from the store
	languageContext.set($language);
	
	// Language switcher functions with direct store updates
	function switchToEnglish(event: MouseEvent) {
		event.preventDefault();
		switchLanguage('en');
	}
	
	function switchToPolish(event: MouseEvent) {
		event.preventDefault();
		switchLanguage('pl');
	}
	
	// Initialize auth FSM on component mount
	onDestroy(() => {
		console.log('Component cleanup');
	});
	
	// For debugging
	$effect(() => {
		console.log('Auth state:', authFSM.current);
		console.log('Current user from state:', currentUser);
		console.log('User from props data:', data.user);
		console.log('Component mounted:', mounted);
	});
	
	// Function to handle logout with page reload
	function handleLogout() {
		// After form is submitted, reload the page
		setTimeout(() => window.location.reload(), 100);
	}
	
	// Function to check if a given path is active
	function isActive(path: string): boolean {
		return $page.url.pathname === path;
	}
</script>

<div class="layout">
	<header>
		<!-- Logo/Brand -->
		<a href="/tests" title="PSG Dashboard">
			<div>
				<Flame size={20} />
			</div>
			<div>
				<h1>{t('appName', $language)}</h1>
				<span>{t('appDescription', $language)}</span>
			</div>
		</a>
		
		<div class="header-controls">
			<!-- Login button or logout button based on auth state -->
			<!-- <div class="login-area">
				{#if !mounted}
					<div class="loading">Loading...</div>
				{:else}
					<div class="auth-section">
						{#if currentUser}
							<div class="user-info">
								<span class="welcome-text">Welcome, {currentUser?.username || currentUser?.email}</span>
								<form action="/logout" method="POST" onsubmit={() => handleLogout()}>
									<button type="submit" class="logout-btn">Logout</button>
								</form>
							</div>
						{:else if authFSM.current === 'loading'}
							<span>Loading...</span>
						{:else}
							<a href="/login" class="login-btn">Login</a>
						{/if}
					</div>
				{/if}
			</div> -->
			
			<!-- Language switcher -->
			<div class="language-switcher">
				<button 
					class:active={$language === 'en'} 
					onclick={switchToEnglish}
					aria-label="Switch to English"
				>
					EN
				</button>
				<button 
					class:active={$language === 'pl'} 
					onclick={switchToPolish}
					aria-label="Switch to Polish"
				>
					PL
				</button>
			</div>
		</div>
	</header>

	<div class="content-wrapper">
		<!-- Navigation sidebar -->
		<!-- <div class="dashboard-nav">
			<div class="nav-section">
				<h3>{t('nav.main', $language)}</h3>
				<ul>
					<li class:active={isActive('/')}>
						<a href="/" class="nav-link" title="{t('nav.dashboard', $language)}">
							<BarChart size={20} />
							<span>{t('nav.dashboard', $language)}</span>
						</a>
					</li>
					<li class:active={isActive('/tests')}>
						<a href="/tests" class="nav-link" title="{t('nav.tests', $language)}">
							<Database size={20} />
							<span>{t('nav.tests', $language)}</span>
						</a>
					</li>
					<li class:active={isActive('/reports')}>
						<a href="/reports" class="nav-link" title="{t('nav.reports', $language)}">
							<Table size={20} />
							<span>{t('nav.reports', $language)}</span>
						</a>
					</li>
					<li class:active={isActive('/users')}>
						<a href="/users" class="nav-link" title="{t('nav.users', $language)}">
							<Users size={20} />
							<span>{t('nav.users', $language)}</span>
						</a>
					</li>
					<li class:active={isActive('/settings')}>
						<a href="/settings" class="nav-link" title="{t('nav.settings', $language)}">
							<Settings size={20} />
							<span>{t('nav.settings', $language)}</span>
						</a>
					</li>
				</ul>
			</div>
			
			<div class="nav-section">
				<h3>{t('nav.recent', $language)}</h3>
				<ul class="recent-list">
					<li><a href="#" class="recent-item">Sales Report Q3</a></li>
					<li><a href="#" class="recent-item">User Activity Analysis</a></li>
					<li><a href="#" class="recent-item">Inventory Status</a></li>
				</ul>
			</div>
		</div> -->

		<!-- Main content area -->
		<main>
			{@render children()}
		</main>
	</div>

	<footer>
		<div class="footer-content">
			<p>{t('footer.copyright', $language).replace('{year}', String(currentYear))}</p>
			<p>{t('footer.version', $language)}</p>
		</div>
	</footer>
</div>

<style>
	:root {
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Oxygen,
			Ubuntu,
			Cantarell,
			'Open Sans',
			'Helvetica Neue',
			sans-serif;
		margin: 0;
	}

	.layout {
		display: flex;
		flex-direction: column;
		position: fixed;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
	}

	header {
		padding: 1rem;
		background-color: #1a1a2e; /* Dark header background */
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	header a {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		color: inherit;
	}

	header a div:first-child {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #ff5722;
		color: white;
		padding: 0.5rem;
		border-radius: 8px;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #e2e8f0; /* Light text for dark background */
	}

	header span {
		font-size: 0.8rem;
		color: #9ca3af; /* Muted gray text */
	}
	
	.header-controls {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}
	
	.login-area {
		min-width: 120px;
	}
	
	.login-btn {
		background-color: #38bdf8; /* Brighter blue for dark theme */
		color: #0f172a; /* Dark text on light button */
		border: none;
		border-radius: 4px;
		padding: 0.5rem 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s, transform 0.1s;
		text-decoration: none;
		font-size: 0.9rem;
		display: inline-block;
	}
	
	.login-btn:hover {
		background-color: #7dd3fc; /* Lighter blue on hover */
		transform: translateY(-1px);
	}
	
	.user-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	
	.welcome-text {
		font-size: 0.9rem;
		font-weight: 500;
		color: #e2e8f0; /* Light text */
	}
	
	.logout-btn {
		background-color: #2a2a3c; /* Dark button */
		border: 1px solid #4b5563;
		color: #e2e8f0; /* Light text */
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.2s;
	}
	
	.logout-btn:hover {
		background-color: #374151; /* Slightly lighter on hover */
		border-color: #6b7280;
	}
	
	.language-switcher {
		display: flex;
		gap: 0.5rem;
	}
	
	.language-switcher button {
		background: none;
		border: 1px solid #4b5563; /* Darker border */
		border-radius: 4px;
		padding: 0.25rem 0.6rem;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.2s;
		color: #9ca3af; /* Muted text */
	}
	
	.language-switcher button:hover {
		background-color: #2a2a3c; /* Dark hover state */
		color: #e2e8f0; /* Lighter text on hover */
	}
	
	.language-switcher button.active {
		background-color: #0f3460; /* Dark blue background */
		border-color: #38bdf8; /* Blue border */
		color: #7dd3fc; /* Light blue text */
		font-weight: 500;
	}
	
	.content-wrapper {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	main {
		flex: 1;
		overflow: auto;
		background-color: #1e1e2e; /* Dark background to match tests page */
	}

	/* Dashboard Navigation */
	.dashboard-nav {
		background: #f8f9fb;
		border-right: 1px solid #eaedf2;
		width: 280px;
		height: 100%;
		padding: 1.5rem 0;
		overflow-y: auto;
	}
	
	.nav-section {
		margin-bottom: 2rem;
		padding: 0 1.5rem;
	}
	
	.nav-section h3 {
		color: #8a94a6;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 1rem;
	}
	
	.nav-section ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	
	.nav-section li {
		margin-bottom: 0.5rem;
	}
	
	.nav-link {
		display: flex;
		align-items: center;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		color: #4b5563;
		font-weight: 500;
		text-decoration: none;
		transition: all 0.15s ease;
	}
	
	.nav-link:hover {
		background: rgba(59, 130, 246, 0.08);
		color: #3b82f6;
	}
	
	li.active .nav-link {
		background: #3b82f6;
		color: white;
	}
	
	.nav-link span {
		margin-left: 0.75rem;
	}
	
	.recent-list li {
		margin-bottom: 0.5rem;
	}
	
	.recent-item {
		display: block;
		padding: 0.5rem 1rem;
		color: #4b5563;
		font-size: 0.9rem;
		text-decoration: none;
		border-radius: 0.5rem;
		transition: all 0.15s ease;
	}
	
	.recent-item:hover {
		background: rgba(59, 130, 246, 0.08);
		color: #3b82f6;
	}

	footer {
		background-color: #1a1a2e; /* Dark footer background */
		border-top: 1px solid #2d2d42; /* Darker border */
		font-size: 0.75rem;
		color: #9ca3af; /* Muted gray text */
		padding: 0.5rem 1rem;
		z-index: 10;
	}

	.footer-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	footer p {
		margin: 0;
	}
</style>
