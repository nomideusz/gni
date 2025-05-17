import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { authFSM } from '$lib/auth';

// Redirect to login page if user tries to access this page directly
export const load = async () => {
    throw redirect(303, '/login');
};

export const actions: Actions = {
    default: async ({ locals }) => {
        // Log the user out
        try {
            if (locals.pb) {
                locals.pb.authStore.clear();
            }
            
            // Trigger the FSM logout event
            authFSM.send('logout');
            
            // The FSM will automatically transition to loggedOut after animation
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { error: 'Failed to logout' };
        } finally {
            // Always redirect to home page after logout
            throw redirect(303, '/');
        }
    }
}; 