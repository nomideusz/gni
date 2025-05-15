import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // Check if user is authenticated
    const isAuthenticated = locals.pb?.authStore?.isValid || false;
    
    // Get user info if authenticated
    const user = isAuthenticated ? locals.user : null;
    
    // Safely get expiration date
    let expiresDate = null;
    try {
        if (locals.pb?.authStore?.isValid && locals.pb?.authStore?.model?.exp) {
            const expTimestamp = locals.pb.authStore.model.exp;
            if (typeof expTimestamp === 'number') {
                expiresDate = new Date(expTimestamp * 1000).toISOString();
            }
        }
    } catch (err) {
        console.error("Error parsing expiration date:", err);
    }
    
    return {
        isAuthenticated,
        user,
        authDetails: {
            token: locals.pb?.authStore?.token || null,
            model: locals.pb?.authStore?.model ? 'Present' : 'Not present',
            expires: expiresDate
        }
    };
}; 