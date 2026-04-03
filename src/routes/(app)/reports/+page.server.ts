import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, fetch, depends }) => {
    depends('reports:data');

    if (!locals.pb || !locals.pb.authStore.isValid) {
        throw redirect(303, '/login');
    }

    async function getReportsData() {
        try {
            const apiUrl = '/api/v1/reports?limit=500&sort=-report_date&finalOnly=false&includeUnitDesc=true&withSurveys=true';
            const apiResponse = await fetch(apiUrl);

            if (!apiResponse.ok) {
                throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
            }

            return await apiResponse.json();
        } catch (error) {
            if (error instanceof Response) throw error;
            console.error('Error loading reports data:', error);
            return {
                reports: [],
                stats: {
                    totalReports: 0,
                    calculationReportsCount: 0,
                    reportCounts: { all: 0, withSurveys: 0, final: 0, finalWithSurveys: 0, draftWithSurveys: 0 },
                    totalIndications: 0,
                    totalGaps: 0,
                    car1Distance: 0,
                    car2Distance: 0,
                    car3Distance: 0
                },
                meta: { page: 1, totalPages: 0, totalItems: 0, perPage: 0 },
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async function getSyncStatus() {
        try {
            const syncResponse = await fetch('/api/v1/sync-status');
            if (!syncResponse.ok) {
                throw new Error(`Sync API request failed: ${syncResponse.status} ${syncResponse.statusText}`);
            }
            return await syncResponse.json();
        } catch (error) {
            console.error('Error fetching sync status:', error);
            return null;
        }
    }

    // Return promises directly for SvelteKit streaming
    return {
        reportsData: getReportsData(),
        syncData: getSyncStatus()
    };
};
