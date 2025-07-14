import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
    // Check if user is authenticated
    if (!locals.user) {
        // If not authenticated, redirect to login page
        throw redirect(303, '/login');
    }
    
    // Check if user has admin role using the isAdmin property
    if (!locals.isAdmin) {
        // If not admin, redirect to unauthorized page
        throw redirect(303, '/unauthorized');
    }
    
    // If authorized, allow access to the page
    return {
        user: locals.user,
        isAdmin: locals.isAdmin
    };
}) satisfies PageServerLoad; 