import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// This layout will be used for all routes under /protected/* 
// and will ensure the user is authenticated
export const load: LayoutServerLoad = async ({ locals }) => {
    // If the user is not authenticated, redirect to login
    if (!locals.pb.authStore.isValid) {
        throw redirect(303, '/login');
    }
    
    // Otherwise, provide the user data to the route
    return {
        user: locals.user
    };
}; 