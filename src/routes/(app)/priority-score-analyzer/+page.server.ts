import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Function to map disposition values to strings
function mapDisposition(disposition: number | null): string {
    switch (disposition) {
        case 1: return "Natural Gas";
        case 3: return "Possible Natural Gas";
        case 0: return "Not Natural Gas";
        default: return "Unknown";
    }
}

// Function to calculate statistics from the items
function calculateStats(items: any[]) {
    const naturalGasCount = items.filter(item => item.disposition === 1).length;
    const possibleNaturalGasCount = items.filter(item => item.disposition === 3).length;
    const notNaturalGasCount = items.filter(item => item.disposition === 0).length;
    const totalItems = items.length;
    
    return {
        naturalGasCount,
        possibleNaturalGasCount,
        notNaturalGasCount,
        totalItems
    };
}

export const load: PageServerLoad = async ({ locals }) => {
    // Get the current user from locals
    const user = locals.user;
    
    // Ensure user is authenticated
    if (!user) {
        throw redirect(303, '/login');
    }
    
    try {
        // Get PocketBase instance
        const pb = locals.pb;
        if (!pb) {
            throw error(500, 'PocketBase instance not available');
        }
        
        // Check if the collection exists
        let collectionExists = true;
        try {
            await pb.collection('priority_score_data').getList(1, 1);
        } catch (err) {
            console.error('Priority scores collection check error:', err);
            collectionExists = false;
        }
        
        // If collection doesn't exist, return empty result
        if (!collectionExists) {
            return {
                user,
                priorityScoreData: { 
                    items: [],
                    totalItems: 0
                }
            };
        }
        
        // Prepare query options
        const queryOptions = {
            sort: '-report_date',
            fields: 'id,report_title,unique_identifier,report_date,ch4,classification_confidence,max_amplitude,ethane_ratio,detection_probability,emission_rate,representative_emission_rate,representative_bin_label,number_of_passes,number_of_peaks,priority_score_2,disposition'
        };
        
        // Fetch records from the priority_score_data collection with pagination
        // PocketBase limits to 1000 records per request, so we'll fetch multiple pages
        const maxRecords = 3000;
        const recordsPerPage = 1000;
        const maxPages = Math.ceil(maxRecords / recordsPerPage); // 3 pages max
        
        let allItems: any[] = [];
        let totalItems = 0;
        
        // Fetch records page by page
        for (let page = 1; page <= maxPages; page++) {
            try {
                const result = await pb.collection('priority_score_data').getList(page, recordsPerPage, queryOptions);
                
                // Add items from this page
                allItems = allItems.concat(result.items);
                
                // Update total items count from first request
                if (page === 1) {
                    totalItems = result.totalItems;
                }
                
                // If we got fewer than 1000 records, we've reached the end
                if (result.items.length < recordsPerPage) {
                    break;
                }
                
                // If we've reached our desired maximum, stop fetching
                if (allItems.length >= maxRecords) {
                    allItems = allItems.slice(0, maxRecords); // Trim to exactly maxRecords
                    break;
                }
                
            } catch (pageError) {
                console.error(`Error fetching page ${page}:`, pageError);
                // If we can't fetch a page, break and use what we have
                break;
            }
        }

        // Add dispositionLabel while preserving original disposition value
        const enhancedItems = allItems.map(item => ({
            ...item,
            dispositionLabel: mapDisposition(item.disposition)
        }));

        console.log(`Fetched ${enhancedItems.length} records out of ${totalItems} total available`);

        // Return both user and priority items in the format the page expects
        return {
            user,
            priorityScoreData: {
                items: enhancedItems,
                totalItems: Math.min(totalItems, enhancedItems.length) // Use actual fetched count if less than total
            },
            calculatedStats: calculateStats(enhancedItems)
        };
    } catch (err) {
        console.error('Failed to fetch priority score data:', err);
        throw error(500, 'Failed to load priority score data');
    }
}; 