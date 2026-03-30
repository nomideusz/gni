import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => {
    return {
        dashboardData: data.dashboardData,
        syncData: data.syncData
    };
}
