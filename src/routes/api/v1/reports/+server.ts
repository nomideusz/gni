import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * GET - Retrieves reports directly from the local PocketBase database
 * 
 * Query parameters:
 * - limit: number of records to retrieve (default 1000)
 * - page: page number (default 1)
 * - sort: sort field (default -report_date)
 * - finalOnly: only final reports (true/false, default true)
 * - includeUnitDesc: whether to include surveyor_unit_desc field (true/false, default false)
 * - withSurveys: only return reports with surveys (true/false, default true)
 */
export const GET = async ({ url, locals }: RequestEvent) => {
    try {
        // Get PocketBase instance from locals
        const pb = locals.pb;
        if (!pb) {
            return json({
                error: 'PocketBase instance not available',
                reports: []
            }, { status: 500 });
        }

        // Get query parameters
        const limit = parseInt(url.searchParams.get('limit') || '1000');
        const page = parseInt(url.searchParams.get('page') || '1');
        const sort = url.searchParams.get('sort') || '-report_date';
        const finalOnly = url.searchParams.get('finalOnly') !== 'false'; // default true
        const includeUnitDesc = url.searchParams.get('includeUnitDesc') === 'true'; // default false
        const withSurveys = url.searchParams.get('withSurveys') !== 'false'; // default true
        
        console.log('API: Query parameters:', { limit, page, sort, finalOnly, includeUnitDesc, withSurveys });
        
        // Prepare filtering for numeric report_final field (0 or 1)
        const filter = finalOnly ? 'report_final=1' : '';
        
        // Check total number of reports
        const countAll = await pb.collection('gas_reports').getList(1, 1);
        const countFinal = finalOnly ? await pb.collection('gas_reports').getList(1, 1, {
            filter: 'report_final=1'
        }) : { totalItems: countAll.totalItems };
        
        // Use expand to get related driving sessions and indications
        const expandParam = includeUnitDesc 
            ? 'driving_sessions,indications_via_report' 
            : 'indications_via_report';
        
        console.log('API: Using expand parameter:', expandParam);
        
        // Prepare main query options
        const queryOptions: {
            sort: string;
            filter: string;
            expand?: string;
        } = {
            sort,
            filter,
            expand: expandParam
        };
        
        // If no final reports but there are any reports, return all
        const useAllReports = finalOnly && countFinal.totalItems === 0 && countAll.totalItems > 0;
        if (useAllReports) {
            queryOptions.filter = '';
        }
        
        const result = await pb.collection('gas_reports').getList(page, limit, queryOptions);
        
        // Process items - convert types and add needed fields
        const processedItems = result.items.map((item: any) => {
            const convertedItem: any = { ...item };
            
            // Convert numeric report_final (0 or 1) to boolean
            if ('report_final' in convertedItem) {
                // Handle report_final as a number (0 or 1)
                if (typeof convertedItem.report_final === 'number') {
                    convertedItem.report_final = convertedItem.report_final === 1;
                } 
                // For backward compatibility
                else if (typeof convertedItem.report_final === 'string') {
                    // Try to parse as number first
                    const num = parseInt(convertedItem.report_final, 10);
                    if (!isNaN(num)) {
                        convertedItem.report_final = num === 1;
                    } else {
                        // Fallback to string boolean check
                        convertedItem.report_final = convertedItem.report_final.toLowerCase() === 'true';
                    }
                } 
                // Default to Boolean conversion
                else {
                    convertedItem.report_final = Boolean(convertedItem.report_final);
                }
            }
            
            // Process total duration - convert to human readable format
            if ('total_breadcrumb_duration_seconds' in convertedItem) {
                const seconds = Number(convertedItem.total_breadcrumb_duration_seconds || 0);
                // Ensure we keep the original value
                convertedItem.total_duration_seconds = seconds;
                // Format as hours and minutes
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                convertedItem.formatted_duration = hours > 0 
                    ? `${hours}h ${minutes}m` 
                    : `${minutes}m`;
            } else {
                convertedItem.total_duration_seconds = 0;
                convertedItem.formatted_duration = '0m';
            }
            
            // Process total distance - ensure it's a number
            if ('total_breadcrumb_length_meters' in convertedItem) {
                // Convert meters to kilometers and ensure it's a number
                const meters = Number(convertedItem.total_breadcrumb_length_meters || 0);
                convertedItem.total_distance_km = (meters / 1000).toFixed(2);
            } else {
                convertedItem.total_distance_km = '0.00';
            }
            
            // Check if report has driving sessions (surveys)
            const hasDrivingSessions = !!((convertedItem.expand?.driving_sessions && 
                                         Array.isArray(convertedItem.expand.driving_sessions) && 
                                         convertedItem.expand.driving_sessions.length > 0) ||
                                        (convertedItem.driving_sessions && 
                                         Array.isArray(convertedItem.driving_sessions) && 
                                         convertedItem.driving_sessions.length > 0));
            
            // Add flag indicating whether report has driving sessions
            convertedItem.has_surveys = hasDrivingSessions;
            
            // Get surveyor_unit_desc from expanded relation
            if (includeUnitDesc) {
                if (convertedItem.expand && convertedItem.expand.driving_sessions?.length > 0) {
                    const firstSession = convertedItem.expand.driving_sessions[0];
                    convertedItem.surveyor_unit_desc = firstSession.surveyor_unit_desc || 'n/a';
                } else {
                    convertedItem.surveyor_unit_desc = 'n/a';
                }
            } else {
                convertedItem.surveyor_unit_desc = null;
            }
            
            // Add indications from expanded back-relation
            convertedItem.indications = [];
            convertedItem.indicationsCount = 0;
            convertedItem.uniqueIndicationsCount = 0;
            
            if (convertedItem.expand && convertedItem.expand.indications_via_report) {
                // Store the full indications data
                convertedItem.indications = Array.isArray(convertedItem.expand.indications_via_report) 
                    ? convertedItem.expand.indications_via_report 
                    : [];
                
                // Set the total count (including potential duplicates)
                convertedItem.indicationsCount = convertedItem.indications.length;
                
                // Deduplicate indications based on lisa_id or lisa_name
                const uniqueIndications = new Map();
                convertedItem.indications.forEach((indication: any) => {
                    // Use lisa_id if available, otherwise use lisa_name
                    const uniqueId = indication.lisa_id || indication.lisa_name;
                    if (uniqueId) {
                        uniqueIndications.set(uniqueId, indication);
                    }
                });
                
                // Set the count of unique indications
                convertedItem.uniqueIndicationsCount = uniqueIndications.size;
            }
                        
            return convertedItem;
        });
        
        // Apply withSurveys filter after processing if requested
        const filteredItems = withSurveys 
            ? processedItems.filter((item: any) => item.has_surveys) 
            : processedItems;
        
        // ======= ONLY USE FINAL REPORTS WITH SURVEYS FOR CALCULATIONS =======
        // These are the only reports that should be used for calculations
        const calculationReports = processedItems.filter((r: any) => 
            r.has_surveys && 
            (r.report_final === true || r.report_final === 1 || r.report_final === '1' || r.report_final === 'true')
        );
        
        // Count reports by status
        const reportStatusCount = {
            all: processedItems.length,
            withSurveys: processedItems.filter((r: any) => r.has_surveys).length,
            final: processedItems.filter((r: any) => 
                r.report_final === true || r.report_final === 1 || r.report_final === '1' || r.report_final === 'true'
            ).length,
            finalWithSurveys: calculationReports.length
        };
        
        // Calculate total distance (only from final reports with surveys)
        const totalDistance = calculationReports.reduce((sum: number, report: any) => {
            const distance = report.linear_asset_covered_length ? Number(report.linear_asset_covered_length) : 0;
            return sum + distance;
        }, 0);
        
        // Distance for specific vehicles (only from final reports with surveys)
        const jimnyDistance = calculationReports
            .filter((r: any) => r.surveyor_unit_desc === 'PSG Service car #1 - Suzuki Jimny WE5N810')
            .reduce((sum: number, report: any) => {
                const distance = report.linear_asset_covered_length ? Number(report.linear_asset_covered_length) : 0;
                return sum + distance;
            }, 0);
            
        const torresDistance = calculationReports
            .filter((r: any) => r.surveyor_unit_desc === 'PSG MSA car #1 - Ssanyong Torres')
            .reduce((sum: number, report: any) => {
                const distance = report.linear_asset_covered_length ? Number(report.linear_asset_covered_length) : 0;
                return sum + distance;
            }, 0);
        
        // Get all unique LISAs from calculation reports
        const allUniqueIndications = new Map();
        
        // Process all LISA indications from all calculation reports
        calculationReports.forEach(report => {
            if (report.indications && Array.isArray(report.indications)) {
                report.indications.forEach((indication: any) => {
                    // Use lisa_id if available, otherwise use lisa_name
                    const uniqueId = indication.lisa_id || indication.lisa_name;
                    if (uniqueId) {
                        // Store with the report's surveyor_unit_desc for per-vehicle counting
                        indication.surveyor_unit_desc = report.surveyor_unit_desc;
                        allUniqueIndications.set(uniqueId, indication);
                    }
                });
            }
        });
        
        // Count unique indications
        const uniqueIndicationsArray = Array.from(allUniqueIndications.values());
        const totalUniqueIndications = uniqueIndicationsArray.length;
        
        // Count unique indications per vehicle
        const uniqueJimnyIndications = uniqueIndicationsArray.filter(
            (indication: any) => indication.surveyor_unit_desc === 'PSG Service car #1 - Suzuki Jimny WE5N810'
        ).length;
        
        const uniqueTorresIndications = uniqueIndicationsArray.filter(
            (indication: any) => indication.surveyor_unit_desc === 'PSG MSA car #1 - Ssanyong Torres'
        ).length;
        
        // Calculate LISA per km metrics using unique indications
        const totalLisaPerKm = totalDistance > 0 ? (totalUniqueIndications / totalDistance) : 0;
        const jimnyLisaPerKm = jimnyDistance > 0 ? (uniqueJimnyIndications / jimnyDistance) : 0;
        const torresLisaPerKm = torresDistance > 0 ? (uniqueTorresIndications / torresDistance) : 0;
        
        // Placeholder for work hours - will be loaded from separate API
        const totalWorkHours = 0;
        const jimnyWorkHours = 0;
        const torresWorkHours = 0;
        
        // Calculate statistics
        const stats = {
            totalReports: filteredItems.length,
            calculationReportsCount: calculationReports.length,
            reportCounts: reportStatusCount,
            totalDistance,
            jimnyDistance,
            torresDistance,
            totalIndications: totalUniqueIndications,
            totalRawIndications: calculationReports.reduce((sum, item: any) => sum + (item.indicationsCount || 0), 0),
            jimnyLisaCount: uniqueJimnyIndications,
            torresLisaCount: uniqueTorresIndications,
            totalLisaPerKm,
            jimnyLisaPerKm,
            torresLisaPerKm,
            totalWorkHours,
            jimnyWorkHours,
            torresWorkHours
        };
        
        // Log processed data summary
        console.log('API: Processed reports summary:', {
            total: processedItems.length,
            finalWithSurveys: calculationReports.length,
            filtered: filteredItems.length,
            rawIndicationsCount: stats.totalRawIndications,
            uniqueIndicationsCount: totalUniqueIndications
        });
        
        // Prepare response
        return json({
            reports: filteredItems,
            stats,
            meta: {
                page: result.page,
                totalPages: result.totalPages,
                totalItems: withSurveys ? filteredItems.length : result.totalItems,
                perPage: result.perPage,
                calculationReportsCount: calculationReports.length,
                ...(useAllReports && { note: 'No final reports found, returning all reports' })
            }
        }, {
            headers: {
                'Cache-Control': 'private, max-age=60' // cache for 1 minute
            }
        });
        
    } catch (error) {
        console.error('Error fetching reports from PocketBase:', error);
        return json({
            error: 'Failed to fetch reports',
            details: error instanceof Error ? error.message : String(error),
            reports: []
        }, { status: 500 });
    }
}; 