import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => {
    // Pass through all data from the server, including priorityScoreData
    return data;
}; 