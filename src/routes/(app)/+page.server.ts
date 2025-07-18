import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import type { SyncStatus } from './+page';

export const load: PageServerLoad = async ({ locals, fetch, depends }) => {
    // Mark this load function as dependent on the 'dashboard:data' key
    depends('dashboard:data');

    // Create a function to fetch data that will be deferred
    async function getReportsData() {
        try {
            // Make sure pb is initialized from locals
            const pb = locals.pb;
            if (!pb) {
                throw new Error('PocketBase client not initialized');
            }
            
            // Redirect to login if not authenticated (instead of returning auth data)
            if (!pb.authStore.isValid) {
                throw redirect(303, '/login');
            }
            
            console.log('Loading reports from API endpoint...');
            
            // Use the API endpoint to get data instead of calculating statistics here
            // Include withSurveys=true to ensure we only get reports with surveys
            const apiUrl = '/api/v1/reports?limit=500&sort=-report_date&finalOnly=false&includeUnitDesc=true&withSurveys=true';
            const apiResponse = await fetch(apiUrl);
            
            if (!apiResponse.ok) {
                throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
            }
            
            const apiData = await apiResponse.json();
            
            console.log(`Received ${apiData.reports.length} reports from API endpoint (calculation reports: ${apiData.stats.calculationReportsCount})`);
            
            return {
                reports: apiData.reports,
                recentReports: apiData.reports.slice(0, 5),
                stats: {
                    totalReports: apiData.stats.totalReports,
                    finalReports: apiData.stats.reportCounts.final, // All final reports (with or without surveys)
                    draftReports: apiData.stats.totalReports - apiData.stats.reportCounts.final,
                    totalDistance: apiData.stats.totalDistance,
                    car1Distance: apiData.stats.car1Distance,
                    car2Distance: apiData.stats.car2Distance,
                    car3Distance: apiData.stats.car3Distance || 0,
                    car4Distance: apiData.stats.car4Distance || 0,
                    totalDraftDistance: apiData.stats.totalDraftDistance || 0,
                    car1DraftDistance: apiData.stats.car1DraftDistance || 0,
                    car2DraftDistance: apiData.stats.car2DraftDistance || 0,
                    car3DraftDistance: apiData.stats.car3DraftDistance || 0,
                    car4DraftDistance: apiData.stats.car4DraftDistance || 0,
                    totalIndications: apiData.stats.totalIndications,
                    totalGaps: apiData.stats.totalGaps,
                    car1LisaCount: apiData.stats.car1LisaCount,
                    car2LisaCount: apiData.stats.car2LisaCount,
                    car3LisaCount: apiData.stats.car3LisaCount || 0,
                    car4LisaCount: apiData.stats.car4LisaCount || 0,
                    totalLisaPerKm: apiData.stats.totalLisaPerKm,
                    car1LisaPerKm: apiData.stats.car1LisaPerKm,
                    car2LisaPerKm: apiData.stats.car2LisaPerKm,
                    car3LisaPerKm: apiData.stats.car3LisaPerKm || 0,
                    car4LisaPerKm: apiData.stats.car4LisaPerKm || 0,
                    totalWorkHours: apiData.stats.totalWorkHours || 0,
                    car1WorkHours: apiData.stats.car1WorkHours || 0,
                    car2WorkHours: apiData.stats.car2WorkHours || 0,
                    car3WorkHours: apiData.stats.car3WorkHours || 0,
                    car4WorkHours: apiData.stats.car4WorkHours || 0
                },
                meta: apiData.meta
            };
        } catch (error) {
            // Handle redirects by re-throwing them
            if (error instanceof Response) throw error;
            
            console.error('Error loading reports data:', error);
            return {
                reports: [],
                recentReports: [],
                stats: null,
                meta: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    // Create a function to fetch sync status separately
    async function getSyncStatus() {
        try {
            const syncResponse = await fetch('/api/v1/sync-status');
            
            if (!syncResponse.ok) {
                throw new Error(`Sync API request failed: ${syncResponse.status} ${syncResponse.statusText}`);
            }
            
            const syncInfo = await syncResponse.json();
            console.log('Sync info from API:', syncInfo);
            return { syncInfo };
        } catch (syncError) {
            console.error('Error fetching sync status:', syncError);
            return { 
                syncInfo: null,
                syncError: syncError instanceof Error ? syncError.message : String(syncError)
            };
        }
    }
    
    // Return promises directly - this enables SvelteKit's streaming mode
    // The UI will render immediately with loading states while these promises resolve
    return {
        dashboardData: getReportsData(),
        syncData: getSyncStatus()
    };
}; 