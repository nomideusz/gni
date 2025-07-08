import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * GET - Retrieves priority score data from the local PocketBase database
 * 
 * Query parameters:
 * - limit: number of records to retrieve (default 1000)
 * - page: page number (default 1)
 * - sort: sort field (default -priority_score_2)
 * - customer: filter by customer name (optional)
 * - report: filter by report name (optional)
 */
export const GET = async ({ url, locals }: RequestEvent) => {
    try {
        // Get PocketBase instance from locals
        const pb = locals.pb;
        if (!pb) {
            return json({
                error: 'PocketBase instance not available',
                priorityScoreData: { items: [] }
            }, { status: 500 });
        }

        // Get query parameters
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const page = parseInt(url.searchParams.get('page') || '1');
        const sort = url.searchParams.get('sort') || '-priority_score_2';
        const customer = url.searchParams.get('customer');
        const report = url.searchParams.get('report');
        
        console.log('API: Priority Score Query parameters:', { limit, page, sort, customer, report });
        
        // Prepare filtering (only data after July 1st, 2025)
        let filter = 'created >= "2025-07-01"';
        
        if (customer) {
            filter += ` && customer_name~"${customer}"`;
        }
        
        if (report) {
            filter += ` && report_name~"${report}"`;
        }
        
        // Check if the collection exists
        let collectionExists = true;
        try {
            await pb.collection('priority_score_data').getList(1, 1, {
                filter: 'created >= "2025-07-01"'
            });
        } catch (error) {
            console.error('Priority scores collection check error:', error);
            // Likely collection doesn't exist yet
            collectionExists = false;
        }
        
        // If collection doesn't exist, return empty result
        if (!collectionExists) {
            return json({
                priorityScoreData: { 
                    items: [],
                    page: 1,
                    perPage: limit,
                    totalItems: 0,
                    totalPages: 0
                },
                meta: {
                    error: 'Priority scores collection not found'
                }
            });
        }
        
        // Prepare query options
        const queryOptions: {
            sort: string;
            filter?: string;
            fields?: string;
        } = {
            sort,
            // Select only the fields we need
            fields: 'id,collectionId,collectionName,created,updated,report_title,unique_identifier,ch4,classification_confidence,emission_rate,ethane_ratio,max_amplitude,number_of_passes,number_of_peaks,representative_emission_rate,representative_bin_label,priority_score_2'
        };
        
        if (filter) {
            queryOptions.filter = filter;
        }
        
        // Fetch data from the priority_score_data collection
        const result = await pb.collection('priority_score_data').getList(page, limit, queryOptions);
        
        // Process items - ensure numeric values are properly formatted
        const processedItems = result.items.map((item: any) => {
            const convertedItem: any = { ...item };
            
            // Ensure numeric fields are actual numbers
            const numericFields = [
                'emission_rate', 'max_amplitude', 
                'ch4', 'classification_confidence', 
                'ethane_ratio', 
                'number_of_passes', 'number_of_peaks', 
                'representative_emission_rate', 'priority_score_2'
            ];
            
            numericFields.forEach(field => {
                if (field in convertedItem && convertedItem[field] !== null && convertedItem[field] !== undefined) {
                    // Convert string numeric values to actual numbers
                    if (typeof convertedItem[field] === 'string') {
                        const parsed = parseFloat(convertedItem[field]);
                        if (!isNaN(parsed)) {
                            convertedItem[field] = parsed;
                        }
                    }
                }
            });
            
            // Remove fields we don't need in the UI to improve performance
            const fieldsToRemove = [
                'report_date', 
                'disposition', 
                'detection_probability', 
                'ethane_ratio_uncertainty', 
                'peak_number', 
                'labels',
                'report_name',
                'lisa_number',
                'is_filtered',
                'priority_score',
                'ranking_group'
            ];
            
            fieldsToRemove.forEach(field => {
                if (field in convertedItem) {
                    delete convertedItem[field];
                }
            });
            
            return convertedItem;
        });
        
        // Prepare response
        return json({
            priorityScoreData: {
                items: processedItems,
                page: result.page,
                perPage: result.perPage,
                totalItems: result.totalItems,
                totalPages: result.totalPages
            }
        }, {
            headers: {
                'Cache-Control': 'private, max-age=60' // cache for 1 minute
            }
        });
        
    } catch (error) {
        console.error('Error fetching priority score data from PocketBase:', error);
        return json({
            error: 'Failed to fetch priority score data',
            details: error instanceof Error ? error.message : String(error),
            priorityScoreData: { items: [] }
        }, { status: 500 });
    }
}; 