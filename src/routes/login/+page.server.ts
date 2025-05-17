import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { authFSM } from '$lib/auth';

export const actions: Actions = {
    default: async ({ request, locals }) => {
        // Extract form data
        const formData = await request.formData();
        const data = Object.fromEntries(formData.entries());
        const email = data.email as string;
        
        try {
            // Try to authenticate
            if (!locals.pb) {
                return { error: 'Authentication service unavailable', email };
            }
            
            // Trigger FSM login event
            authFSM.send('login');
            
            // Attempt authentication
            await locals.pb.collection('users').authWithPassword(
                email,
                data.password as string
            );
            
            // The FSM will handle transition to loggedIn after animation
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            
            // If login failed, manually transition to loggedOut
            if (authFSM.current === 'loggingIn') {
                authFSM.send('finishTransition');
                authFSM.send('logout');
            }
            
            return { error: 'Invalid email or password', email };
        } finally {
            // Redirect to home on successful login or stay on login page on error
            if (locals.pb?.authStore.isValid) {
                throw redirect(303, '/');
            }
        }
    }
}; 