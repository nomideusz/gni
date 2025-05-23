import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, url }: RequestEvent) => {
	// For most auth pages, we want to redirect already authenticated users to the dashboard
	// Individual auth routes can override this behavior if needed
	if (locals.pb?.authStore?.isValid) {
		console.log('Auth layout load: User is authenticated, current path:', url.pathname);
		
		// Don't redirect from logout route
		if (!url.pathname.includes('/logout')) {
			console.log('Redirecting authenticated user to / from auth layout');
			throw redirect(303, '/');
		}
	} else {
		console.log('Auth layout load: User is not authenticated');
	}

	return {
		user: locals.user
	};
}; 