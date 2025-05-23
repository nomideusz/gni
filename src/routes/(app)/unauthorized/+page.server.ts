import type { PageServerLoad } from './$types';

export const load = (async () => {
    // Simple load function to ensure proper server-side rendering
    return {
        status: 403,
        message: 'Unauthorized Access'
    };
}) satisfies PageServerLoad; 