<script lang="ts">
	import '$lib/styles/typography.css';
	import '$lib/styles/theme.css';
	import '$lib/styles/layout.css';
	import '$lib/styles/ui-components.css';
	import Flame from 'lucide-svelte/icons/flame';
	import BarChart from 'lucide-svelte/icons/bar-chart';
	import Database from 'lucide-svelte/icons/database';
	import Settings from 'lucide-svelte/icons/settings';
	import Table from 'lucide-svelte/icons/table';
	import Loader from 'lucide-svelte/icons/loader';
	import { language, t, LANGUAGES } from '$lib';
	import { initialUserValue, setupAuthListener, pb } from '$lib/pocketbase';
	import { onDestroy, onMount } from 'svelte';
	import { languageContext, switchLanguage, languageStore, navigationContext, navigationStore } from '$lib/context';
	import { authFSM, updateAuthState, authContext, authStore } from '$lib/auth';
	import { IsMounted } from 'runed';
	import AuthStatus from './AuthStatus.svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { APP_VERSION } from '$lib/version';
	
	interface LayoutData {
		user: any;
		isAuthenticated: boolean;
	}
	
	let { children, data } = $props<{data: LayoutData}>();
	
	// Use IsMounted from Runed
	const isMounted = new IsMounted();
	
	// Initialize auth store with initial values as early as possible
	authStore.set({
		isAuthenticated: !!data.user,
		user: data.user || null,
		state: data.user ? 'loggedIn' : 'loggedOut'
	});
	
	// Initialize context with the store - this should only happen once during initialization
	authContext.set(authStore);
	
	// Track logout loading state
	let isLoggingOut = $state(false);
	
	// Minimum loading time for animations
	const MIN_LOADING_TIME = 800;
	
	// Form reference for programmatic submission
	let logoutForm = $state<HTMLFormElement | null>(null);
	
	// Create a state for the current user
	let currentUser = $state(initialUserValue || data.user || null);
	
	// Create an explicitly typed variable for clarity in comparisons
	type AuthState = 'loggedOut' | 'loggedIn' | 'loading' | 'loggingIn' | 'loggingOut';
	
	// Track auth state separately to ensure UI consistency
	let authState = $state<AuthState>(authFSM.current);
	
	// Helper function for type-safe auth state comparison
	function isAuthState(state: AuthState, compare: AuthState): boolean {
		return state === compare;
	}
	
	// Update currentUser with data from server
	$effect(() => {
		if (data.user) {
			console.log('User data from server:', data.user);
			currentUser = data.user;
			updateAuthState(data.user);
		}
	});
	
	// For debugging - use proper state snapshot for state values
	$effect(() => {
		// Create a snapshot of the state for logging
		const currentUserSnapshot = $state.snapshot(currentUser);
		
		console.log('Auth state:', authFSM.current);
		console.log('Current user from state:', currentUserSnapshot);
		console.log('User from props data:', data.user);
		console.log('Component mounted:', isMounted.current);
		console.log('Is authenticated (server):', data.isAuthenticated);
		
		// Make sure we update FSM if props data shows authentication
		if (data.isAuthenticated && authState !== 'loggedIn') {
			console.log('Props data shows authenticated but FSM disagrees - fixing');
			updateAuthState({ exists: true, forceAuth: true });
		}
	});
	
	// Watch for auth state changes
	$effect(() => {
		authState = authFSM.current;
		console.log('Auth state updated:', authState);
		
		// Force update to ensure UI reflects current auth state
		if (data.isAuthenticated && authState !== 'loggedIn') {
			console.log('Auth mismatch - Server says authenticated but FSM says:', authState);
			// Update FSM if server indicates user is authenticated - use force flag
			updateAuthState({ exists: true, forceAuth: true });
		}
		
		// Update auth store whenever auth state or user changes
		authStore.update(() => ({
			isAuthenticated: data.isAuthenticated || authState === 'loggedIn',
			user: currentUser,
			state: authState
		}));
	});
	
	// Set component as mounted and immediately sync auth state
	onMount(() => {
		// Force auth state check on mount with stronger enforcement
		console.log('Component mounted, checking auth state; Server says authenticated:', data.isAuthenticated);
		
		// Set the currentUser state from server data if available
		if (data.user) {
			console.log('Setting currentUser from server data:', data.user.email);
			currentUser = data.user;
		}
		
		// Immediately set the FSM state based on server authentication
		if (data.isAuthenticated) {
			console.log('Setting FSM to match server authenticated state');
			// Only update if necessary - avoid transitions if already in the right state
			if (authFSM.current !== 'loggedIn') {
				if (authFSM.current === 'loggingIn') {
					// If we're already transitioning, just speed it up
					authFSM.send('finishTransition');
				} else {
					// Otherwise, start the login process
					updateAuthState({ exists: true, forceAuth: true });
				}
			}
			// Double-check the transition happened
			console.log('FSM state after server auth sync:', authFSM.current);
		} else if (data.isAuthenticated === false) {
			// Explicitly set to logged out if server says not authenticated
			console.log('Server says not authenticated, ensuring logged out state');
			if (authFSM.current !== 'loggedOut' && authFSM.current !== 'loggingOut') {
				authFSM.send('logout');
			}
		}
	});
	
	// Set up auth listener to update currentUser
	const cleanup = setupAuthListener((user) => {
		console.log('Auth listener triggered with user:', user ? 'User exists' : 'No user');
		currentUser = user;
		// Update FSM state manually when currentUser changes
		updateAuthState(user);
	});
	
	// Clean up listener on component destruction
	onDestroy(cleanup);
	
	// Get current year for the footer
	const currentYear = new Date().getFullYear();
	
	// Set language context from the store
	languageContext.set(languageStore);
	
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
	
	// Function to handle logout with loading state
	async function handleLogout(event: Event) {
		// Prevent default form submission
		event.preventDefault();
		
		// Don't trigger twice
		if (isLoggingOut) return;
		
		// Set loading state immediately for UI change
		isLoggingOut = true;
		
		// Log for debugging
		console.log('Logging out... Animation starting.');
		
		// Set FSM state to loggingOut immediately 
		authFSM.send('logout');
		
		// Ensure the UI has time to update before the animation
		await new Promise(resolve => setTimeout(resolve, 20));
		
		// Wait for the minimum animation time before submitting the form
		// Use longer time for visibility
		const ANIMATION_DISPLAY_TIME = 1200;
		
		await new Promise(resolve => {
			setTimeout(() => {
				console.log(`Logout animation shown for ${ANIMATION_DISPLAY_TIME}ms, proceeding with logout`);
				
				// Manually submit the form after the animation has shown
				if (logoutForm) {
					logoutForm.submit();
				} else {
					console.error('Logout form not found');
				}
				
				resolve(null);
			}, ANIMATION_DISPLAY_TIME);
		});
	}
	
	// Set up navigation context
	navigationContext.set(navigationStore);
	
	// Loading delay timer reference
	let loadingTimer: ReturnType<typeof setTimeout> | null = null;
	// Flag to track if this is the initial page load
	let isInitialLoad = true;
	
	// Track navigation changes with loading state
	beforeNavigate(({ from, to, type }) => {
		// Skip showing loader on initial page load to allow skeleton UI to show first
		if (isInitialLoad) {
			isInitialLoad = false;
			return;
		}
		
		// Only show loader for slow full-page navigations, not for:
		// - Hash changes (anchors)
		// - Search param changes
		// - Same-route data reloads
		const isFullNavigation = from && to && 
			from.url.pathname !== to.url.pathname;
		
		if (isFullNavigation) {
			// Set navigating state immediately
			navigationStore.update(state => ({ ...state, isNavigating: true }));
			
			// Set a timer to show loader only if navigation takes longer than 400ms
			loadingTimer = setTimeout(() => {
				navigationStore.update(state => ({ ...state, shouldShowLoader: true }));
			}, 400); // Slightly increased delay for skeleton UI to take precedence
		}
	});
	
	afterNavigate(({ to }) => {
		// Clear the timer if navigation completes quickly
		if (loadingTimer) {
			clearTimeout(loadingTimer);
			loadingTimer = null;
		}
		
		// Update pathname and reset loading states
		if (to?.url) {
			navigationStore.set({ 
				pathname: to.url.pathname,
				isNavigating: false,
				shouldShowLoader: false
			});
		}
	});
	
	// Function to check if a given path is active using navigation context
	function isActive(path: string, exact = false): boolean {
		// Get current pathname from navigation store
		const currentPathname = $navigationStore.pathname;
		
		if (exact) {
			return currentPathname === path;
		}
		
		// For nested routes, check if pathname starts with the path
		// But ensure we don't treat /reports as active when on /report-details
		return currentPathname === path || 
			(currentPathname.startsWith(path) && path !== '/' && 
			(currentPathname.charAt(path.length) === '/' || currentPathname.length === path.length));
	}
</script>

<!-- Ensure the auth context is properly provided to all children -->
<div class="layout">
	<!-- Context is already set in the script section -->
	<header class="header">
		<!-- Logo/Brand -->
		<a href="/" class="header__brand" title="PSG Dashboard">
			<div class="header__logo">
				<Flame size={18} />
			</div>
			<div class="header__brand-text">
				<span class="header__brand-name">{t('appName', $language)}</span>
				<span class="header__brand-description">{t('appDescription', $language)}</span>
			</div>
		</a>
		
		<div class="header__controls">
			<!-- Login button or logout button based on auth state -->
			<div class="header__login-area">
				{#if !isMounted.current}
					<div class="header__loading">{t('auth.loading', $language)}</div>
				{:else}
					<div class="auth-section">
						<!-- Fix login button checks -->
						{#if data.isAuthenticated}
							<div class="auth__user-info">
								<span class="auth__welcome-text">{currentUser?.username || currentUser?.email || 'User'}</span>
								<form action="/logout" method="POST" bind:this={logoutForm} onsubmit={handleLogout}>
									<button type="submit" class="button button--logout" disabled={isLoggingOut}>
										{#if isLoggingOut}
											<span class="button__spinner"><Loader size={14} /></span>
											<span>{t('auth.loggingOut', $language)}</span>
										{:else}
											<span>{t('auth.logout', $language)}</span>
										{/if}
									</button>
								</form>
							</div>
						{:else if isAuthState(authState, 'loggingIn') || isAuthState(authState, 'loading')}
							<span class="auth__state-indicator">
								<span class="button__spinner"><Loader size={14} /></span>
								{t('auth.loading', $language)}
							</span>
						{:else}
							<a href="/login" class="button button--login">{t('auth.login', $language)}</a>
						{/if}
					</div>
				{/if}
			</div>
			
			<!-- Language switcher -->
			<div class="lang-switcher">
				<button 
					class:lang-switcher__button--active={$language === 'en'} 
					class="lang-switcher__button"
					onclick={switchToEnglish}
					aria-label="Switch to English"
				>
					EN
				</button>
				<button 
					class:lang-switcher__button--active={$language === 'pl'} 
					class="lang-switcher__button"
					onclick={switchToPolish}
					aria-label="Switch to Polish"
				>
					PL
				</button>
			</div>
		</div>
	</header>

	<div class="layout__content">
		<!-- Navigation sidebar -->
		<nav class="nav">
			<div class="nav__section">
				<h3 class="nav__heading">{t('nav.main', $language)}</h3>
				<ul class="nav__list">
					<li class="nav__item" class:nav__item--active={isActive('/', true)}>
						<a href="/" class="nav__link" title="{t('nav.dashboard', $language)}">
							<BarChart size={20} class="nav__icon" />
							<span class="nav__text">{t('nav.dashboard', $language)}</span>
						</a>
					</li>
					<li class="nav__item" class:nav__item--active={isActive('/reports')}>
						<a href="/reports" class="nav__link" title="{t('nav.reports', $language)}">
							<Table size={20} class="nav__icon" />
							<span class="nav__text">{t('nav.reports', $language)}</span>
						</a>
					</li>
					<li class="nav__item" class:nav__item--active={isActive('/tests')}>
						<a href="/tests" class="nav__link" title="{t('nav.tests', $language)}">
							<Database size={20} class="nav__icon" />
							<span class="nav__text">{t('nav.tests', $language)}</span>
						</a>
					</li>
					<li class="nav__item" class:nav__item--active={isActive('/settings')}>
						<a href="/settings" class="nav__link" title="{t('nav.settings', $language)}">
							<Settings size={20} class="nav__icon" />
							<span class="nav__text">{t('nav.settings', $language)}</span>
						</a>
					</li>
				</ul>
			</div>
			
			<div class="nav__section">
				<h3 class="nav__heading">{t('nav.tools', $language)}</h3>
				<ul class="nav__list">
					<li class="nav__item" class:nav__item--active={isActive('/survey-viewer')}>
						<a href="/survey-viewer" class="nav__link" title="{t('tools.surveyViewer', $language)}">
							<Database size={20} class="nav__icon" />
							<span class="nav__text">{t('tools.surveyViewer', $language)}</span>
						</a>
					</li>
				</ul>
			</div>
		</nav>

		<!-- Main content area -->
		<main class="main">
			{@render children()}
		</main>

		{#if $navigationStore.shouldShowLoader}
			<div class="navigation-loader navigation-loader--minimal">
				<div class="navigation-loader__spinner">
					<Loader size={18} />
					<span class="navigation-loader__text">{t('loading.pageLoading', $language)}</span>
				</div>
			</div>
		{/if}
	</div>

	<footer class="footer">
		<div class="footer__content">
			<p class="footer__text">{t('footer.copyright', $language).replace('{year}', String(currentYear))}</p>
			<p class="footer__text">{t('footer.version', $language)} {APP_VERSION}</p>
		</div>
	</footer>
	
	<!-- Debugging component - remove in production -->
	<!-- {#if import.meta.env.DEV}
		<div style="position: fixed; bottom: 60px; right: 10px; z-index: 1000;">
			<AuthStatus />
		</div>
	{/if} -->
</div>