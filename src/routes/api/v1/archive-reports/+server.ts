import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * GET - Retrieves ARCHIVED (2025) reports directly from the local PocketBase database
 * 
 * This is the archive endpoint for the first project (2025).
 * Date range: 2025-07-01 to 2025-12-31
 * Vehicles: 4 (GNI Car #1 through #4)
 */
export const GET = async ({ url, locals }: RequestEvent) => {
    try {
        const pb = locals.pb;
        if (!pb) {
            return json({ error: 'PocketBase instance not available', reports: [] }, { status: 500 });
        }

        const limit = parseInt(url.searchParams.get('limit') || '1000');
        const page = parseInt(url.searchParams.get('page') || '1');
        const sort = url.searchParams.get('sort') || '-report_date';
        const finalOnly = url.searchParams.get('finalOnly') !== 'false';
        const includeUnitDesc = url.searchParams.get('includeUnitDesc') === 'true';
        const withSurveys = url.searchParams.get('withSurveys') !== 'false';
        
        // Archive: 2025 project data only (July 1 - Dec 31, 2025)
        let dateFilter = 'report_date >= "2025-07-01" && report_date < "2026-01-01"';
        
        let filter = dateFilter;
        if (finalOnly) {
            filter += ' && report_final=1';
        }
        
        const countAll = await pb.collection('gas_reports').getList(1, 1, { filter: dateFilter });
        const countFinal = finalOnly ? await pb.collection('gas_reports').getList(1, 1, {
            filter: dateFilter + ' && report_final=1'
        }) : { totalItems: countAll.totalItems };
        
        const expandParam = includeUnitDesc 
            ? 'driving_sessions,indications_via_report,field_of_view_gaps' 
            : 'indications_via_report,field_of_view_gaps';
        
        const queryOptions: { sort: string; filter: string; expand?: string } = {
            sort, filter, expand: expandParam
        };
        
        const useAllReports = finalOnly && countFinal.totalItems === 0 && countAll.totalItems > 0;
        if (useAllReports) {
            queryOptions.filter = dateFilter;
        }
        
        const result = await pb.collection('gas_reports').getList(page, limit, queryOptions);
        
        // Process items
        const processedItems = result.items.map((item: any) => {
            const convertedItem: any = { ...item };
            
            if ('report_final' in convertedItem) {
                if (typeof convertedItem.report_final === 'number') {
                    convertedItem.report_final = convertedItem.report_final === 1;
                } else if (typeof convertedItem.report_final === 'string') {
                    const num = parseInt(convertedItem.report_final, 10);
                    convertedItem.report_final = !isNaN(num) ? num === 1 : convertedItem.report_final.toLowerCase() === 'true';
                } else {
                    convertedItem.report_final = Boolean(convertedItem.report_final);
                }
            }
            
            if ('total_breadcrumb_duration_seconds' in convertedItem) {
                const seconds = Number(convertedItem.total_breadcrumb_duration_seconds || 0);
                convertedItem.total_duration_seconds = seconds;
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                convertedItem.formatted_duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            } else {
                convertedItem.total_duration_seconds = 0;
                convertedItem.formatted_duration = '0m';
            }
            
            if ('total_breadcrumb_length_meters' in convertedItem) {
                const meters = Number(convertedItem.total_breadcrumb_length_meters || 0);
                convertedItem.total_distance_km = (meters / 1000).toFixed(2);
            } else {
                convertedItem.total_distance_km = '0.00';
            }
            
            const hasDrivingSessions = !!((convertedItem.expand?.driving_sessions?.length > 0) ||
                                        (convertedItem.driving_sessions?.length > 0));
            convertedItem.has_surveys = hasDrivingSessions;
            
            if (includeUnitDesc) {
                convertedItem.surveyor_unit_desc = convertedItem.expand?.driving_sessions?.[0]?.surveyor_unit_desc || 'n/a';
            } else {
                convertedItem.surveyor_unit_desc = null;
            }
            
            convertedItem.indications = [];
            convertedItem.indicationsCount = 0;
            convertedItem.uniqueIndicationsCount = 0;
            
            if (convertedItem.expand?.indications_via_report) {
                convertedItem.indications = Array.isArray(convertedItem.expand.indications_via_report) 
                    ? convertedItem.expand.indications_via_report : [];
                convertedItem.indicationsCount = convertedItem.indications.length;
                
                const uniqueIndications = new Map();
                convertedItem.indications.forEach((indication: any) => {
                    const uniqueId = indication.lisa_id || indication.lisa_name;
                    if (uniqueId) uniqueIndications.set(uniqueId, indication);
                });
                convertedItem.uniqueIndicationsCount = uniqueIndications.size;
            }
            
            convertedItem.fieldOfViewGapsCount = 0;
            if (convertedItem.expand?.field_of_view_gaps) {
                const gaps = Array.isArray(convertedItem.expand.field_of_view_gaps) 
                    ? convertedItem.expand.field_of_view_gaps : [];
                convertedItem.fieldOfViewGapsCount = gaps.length;
            }
            
            return convertedItem;
        });
        
        const filteredItems = withSurveys 
            ? processedItems.filter((item: any) => item.has_surveys) 
            : processedItems;
        
        const calculationReports = processedItems.filter((r: any) => 
            (r.report_final === true || r.report_final === 1 || r.report_final === '1' || r.report_final === 'true')
        );
        
        const finalReportsWithSurveys = processedItems.filter((r: any) => 
            r.has_surveys && 
            (r.report_final === true || r.report_final === 1 || r.report_final === '1' || r.report_final === 'true')
        );
        
        const draftReportsWithSurveys = processedItems.filter((r: any) => 
            r.has_surveys && 
            !(r.report_final === true || r.report_final === 1 || r.report_final === '1' || r.report_final === 'true')
        );
        
        const reportStatusCount = {
            all: processedItems.length,
            withSurveys: processedItems.filter((r: any) => r.has_surveys).length,
            final: calculationReports.length,
            finalWithSurveys: finalReportsWithSurveys.length,
            draftWithSurveys: draftReportsWithSurveys.length
        };
        
        // Helper to sum distance for a vehicle from a report set
        const sumDistance = (reports: any[], vehicle?: string) => {
            const filtered = vehicle ? reports.filter((r: any) => r.surveyor_unit_desc === vehicle) : reports;
            return filtered.reduce((sum: number, r: any) => sum + (Number(r.dist_mains_covered_length) || 0), 0);
        };
        
        const totalDistance = sumDistance(finalReportsWithSurveys);
        const car1Distance = sumDistance(finalReportsWithSurveys, 'GNI Car #1');
        const car2Distance = sumDistance(finalReportsWithSurveys, 'GNI Car #2');
        const car3Distance = sumDistance(finalReportsWithSurveys, 'GNI Car #3');
        const car4Distance = sumDistance(finalReportsWithSurveys, 'GNI Car #4');
        
        const totalDraftDistance = sumDistance(draftReportsWithSurveys);
        const car1DraftDistance = sumDistance(draftReportsWithSurveys, 'GNI Car #1');
        const car2DraftDistance = sumDistance(draftReportsWithSurveys, 'GNI Car #2');
        const car3DraftDistance = sumDistance(draftReportsWithSurveys, 'GNI Car #3');
        const car4DraftDistance = sumDistance(draftReportsWithSurveys, 'GNI Car #4');
        
        // Unique LISAs
        const allUniqueIndications = new Map();
        finalReportsWithSurveys.forEach(report => {
            if (report.indications && Array.isArray(report.indications)) {
                report.indications.forEach((indication: any) => {
                    const uniqueId = indication.lisa_id || indication.lisa_name;
                    if (uniqueId) {
                        indication.surveyor_unit_desc = report.surveyor_unit_desc;
                        allUniqueIndications.set(uniqueId, indication);
                    }
                });
            }
        });
        
        const uniqueIndicationsArray = Array.from(allUniqueIndications.values());
        const totalUniqueIndications = uniqueIndicationsArray.length;
        const uniqueCar1 = uniqueIndicationsArray.filter((i: any) => i.surveyor_unit_desc === 'GNI Car #1').length;
        const uniqueCar2 = uniqueIndicationsArray.filter((i: any) => i.surveyor_unit_desc === 'GNI Car #2').length;
        const uniqueCar3 = uniqueIndicationsArray.filter((i: any) => i.surveyor_unit_desc === 'GNI Car #3').length;
        const uniqueCar4 = uniqueIndicationsArray.filter((i: any) => i.surveyor_unit_desc === 'GNI Car #4').length;
        
        const totalLisaPerKm = totalDistance > 0 ? (totalUniqueIndications / totalDistance) : 0;
        const car1LisaPerKm = car1Distance > 0 ? (uniqueCar1 / car1Distance) : 0;
        const car2LisaPerKm = car2Distance > 0 ? (uniqueCar2 / car2Distance) : 0;
        const car3LisaPerKm = car3Distance > 0 ? (uniqueCar3 / car3Distance) : 0;
        const car4LisaPerKm = car4Distance > 0 ? (uniqueCar4 / car4Distance) : 0;
        
        const totalGaps = finalReportsWithSurveys.reduce((sum: number, r: any) => sum + (r.fieldOfViewGapsCount || 0), 0);
        
        const stats = {
            totalReports: filteredItems.length,
            calculationReportsCount: calculationReports.length,
            reportCounts: reportStatusCount,
            totalDistance,
            car1Distance, car2Distance, car3Distance, car4Distance,
            totalDraftDistance,
            car1DraftDistance, car2DraftDistance, car3DraftDistance, car4DraftDistance,
            totalGaps,
            totalIndications: totalUniqueIndications,
            totalRawIndications: finalReportsWithSurveys.reduce((sum, item: any) => sum + (item.indicationsCount || 0), 0),
            car1LisaCount: uniqueCar1, car2LisaCount: uniqueCar2, car3LisaCount: uniqueCar3, car4LisaCount: uniqueCar4,
            totalLisaPerKm, car1LisaPerKm, car2LisaPerKm, car3LisaPerKm, car4LisaPerKm,
            totalWorkHours: 0, car1WorkHours: 0, car2WorkHours: 0, car3WorkHours: 0, car4WorkHours: 0,
        };
        
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
            headers: { 'Cache-Control': 'private, max-age=300' } // 5 min cache for archive
        });
        
    } catch (error) {
        console.error('Error fetching archive reports from PocketBase:', error);
        return json({
            error: 'Failed to fetch archive reports',
            details: error instanceof Error ? error.message : String(error),
            reports: []
        }, { status: 500 });
    }
};
