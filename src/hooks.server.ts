import PocketBase from 'pocketbase';
import type { Handle } from '@sveltejs/kit';

// Add type for locals
declare global {
    namespace App {
        interface Locals {
            pb: PocketBase;
            user: any; // Using any instead of Record as it's not directly exported
        }
    }
}

// Default fallback if env var isn't set
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'https://xeon.pl';

export const handle: Handle = async ({ event, resolve }) => {
    // Initialize PocketBase with URL from environment variable
    event.locals.pb = new PocketBase(POCKETBASE_URL);
    event.locals.user = null;

    // Load the auth store data from the request cookie string
    event.locals.pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

    // If the user is authenticated, set the user in locals
    if (event.locals.pb.authStore.isValid) {
        try {
            // Get an up-to-date auth store state by verifying and refreshing the loaded auth model
            await event.locals.pb.collection('users').authRefresh();
            
            // Set the user data in locals for easy access in routes
            event.locals.user = event.locals.pb.authStore.record;
        } catch (err) {
            // Clear the auth store on failed refresh
            event.locals.pb.authStore.clear();
        }
    }

    // Resolve the request
    const response = await resolve(event);

    // Send back the updated auth cookie to the client
    response.headers.append('set-cookie', event.locals.pb.authStore.exportToCookie({
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax', // Helps with CSRF protection
        httpOnly: true,  // Prevents client-side JS from reading the cookie
        path: '/',       // Make cookie available on all routes
        maxAge: 7 * 24 * 60 * 60 // Cookie expires in 7 days
    }));

    return response;
} 