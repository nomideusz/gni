import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Redirect to login page if user tries to access this page directly
export const load: PageServerLoad = async () => {
    throw redirect(303, '/login');
};

export const actions: Actions = {
    default: async ({ locals }) => {
        try {
            console.log('Logging out user...');
            
            // Check if PocketBase instance exists
            if (!locals.pb) {
                console.error('PocketBase instance is missing in locals');
                throw redirect(303, '/login?error=internal');
            }
            
            // Clear the auth store (logout)
            locals.pb.authStore.clear();
            locals.user = null;
            
            console.log('Logout successful, redirecting to login page');
            
            // Redirect to auth status page to verify logout
            throw redirect(303, '/auth-status?logout=success');
        } catch (err) {
            // Check if it's a redirect response (we shouldn't consider this an error)
            if (err instanceof Response || (err && typeof err === 'object' && 'status' in err && 'location' in err)) {
                // Just re-throw the redirect
                throw err;
            }
            
            // Only log actual errors
            console.error('Error during logout:', err);
            // Redirect to login page even on error
            throw redirect(303, '/login?error=logout');
        }
    }
}; 