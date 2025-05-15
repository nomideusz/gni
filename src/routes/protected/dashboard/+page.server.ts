import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    // We already have authentication check in the layout,
    // so we can focus on fetching additional data for the dashboard

    // Example: You could fetch additional user-specific data here
    // Fetch data for dashboard based on the authenticated user
    
    // For this example, we'll just return the authenticated user data
    return {
        // Any additional data can be added here
    };
}; 