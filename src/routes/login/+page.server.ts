import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    login: async ({ request, locals }) => {
        // Get form data
        const data = await request.formData();
        const email = data.get('email')?.toString();
        const password = data.get('password')?.toString();

        // Validate form data
        if (!email || !password) {
            console.error('Login error: Email or password missing');
            return fail(400, {
                message: 'Email and password are required'
            });
        }

        try {
            console.log('Attempting login with PocketBase URL:', process.env.POCKETBASE_URL);
            
            // Check if PocketBase instance exists
            if (!locals.pb) {
                console.error('PocketBase instance is missing in locals');
                return fail(500, {
                    message: 'Internal server error: PocketBase not initialized'
                });
            }
            
            // Login with PocketBase
            await locals.pb.collection('users').authWithPassword(email, password);
            
            // Log successful login
            console.log('Login successful, redirecting to homepage');
        } catch (err: any) {
            // Log detailed error
            console.error('Login failed with error:', err);
            
            // Return error message on login failure
            return fail(400, {
                message: err.message || 'Login failed'
            });
        }
        
        // If we get here, login was successful, so redirect
        // This is outside the try/catch to avoid catching the redirect
        throw redirect(303, '/');
    }
}; 