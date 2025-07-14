import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST - Fix missing relations in field_of_view and field_of_view_gaps collections
 * 
 * This endpoint repairs the missing report relations by mapping report_id text fields
 * to actual report relations in the database.
 */
export const POST: RequestHandler = async ({ locals }) => {
    try {
        // Check authentication
        if (!locals.user || !locals.isAdmin) {
            return json({ error: 'Admin access required' }, { status: 403 });
        }
        
        const pb = locals.pb;
        if (!pb) {
            return json({ error: 'PocketBase instance not available' }, { status: 500 });
        }
        
        const results = {
            field_of_view: { fixed: 0, failed: 0, noReportFound: 0 },
            field_of_view_gaps: { fixed: 0, failed: 0, noReportFound: 0 },
            gas_reports: { fixed: 0, failed: 0 }
        };
        
        // Fix field_of_view relations
        console.log('[API] Starting field_of_view relations fix...');
        await fixFieldOfViewRelations(pb, results.field_of_view);
        
        // Fix field_of_view_gaps relations
        console.log('[API] Starting field_of_view_gaps relations fix...');
        await fixFieldOfViewGapsRelations(pb, results.field_of_view_gaps);
        
        // Fix reverse relations in gas_reports
        console.log('[API] Starting gas_reports relations fix...');
        await fixGasReportsRelations(pb, results.gas_reports);
        
        return json({
            success: true,
            message: 'Relations fix completed',
            results
        });
        
    } catch (error) {
        console.error('Error in fix-relations API:', error);
        return json({ 
            error: 'Failed to fix relations',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
};

// Fix field_of_view relations
async function fixFieldOfViewRelations(pb: any, stats: any) {
    let page = 1;
    const perPage = 100;
    
    while (true) {
        try {
            // Get records that have report_id but no report relation
            const records = await pb.collection('field_of_view').getList(page, perPage, {
                filter: 'report_id != "" && report = ""'
            });
            
            if (records.items.length === 0) {
                break;
            }
            
            for (const record of records.items) {
                try {
                    // Find the corresponding report by report_id
                    const reports = await pb.collection('gas_reports').getList(1, 1, {
                        filter: `report_id = "${record.report_id}"`
                    });
                    
                    if (reports.items.length > 0) {
                        // Update the record with the report relation
                        await pb.collection('field_of_view').update(record.id, {
                            report: reports.items[0].id
                        });
                        stats.fixed++;
                    } else {
                        console.warn(`No report found for field_of_view record ${record.id} with report_id: ${record.report_id}`);
                        stats.noReportFound++;
                    }
                } catch (error) {
                    console.error(`Error fixing field_of_view record ${record.id}:`, error);
                    stats.failed++;
                }
            }
            
            if (records.totalPages <= page) {
                break;
            }
            page++;
        } catch (error) {
            console.error('Error fetching field_of_view records:', error);
            break;
        }
    }
}

// Fix field_of_view_gaps relations
async function fixFieldOfViewGapsRelations(pb: any, stats: any) {
    let page = 1;
    const perPage = 100;
    
    while (true) {
        try {
            // Get records that have report_id but no report relation
            const records = await pb.collection('field_of_view_gaps').getList(page, perPage, {
                filter: 'report_id != "" && report = ""'
            });
            
            if (records.items.length === 0) {
                break;
            }
            
            for (const record of records.items) {
                try {
                    // Find the corresponding report by report_id
                    const reports = await pb.collection('gas_reports').getList(1, 1, {
                        filter: `report_id = "${record.report_id}"`
                    });
                    
                    if (reports.items.length > 0) {
                        // Update the record with the report relation
                        await pb.collection('field_of_view_gaps').update(record.id, {
                            report: reports.items[0].id
                        });
                        stats.fixed++;
                    } else {
                        console.warn(`No report found for field_of_view_gaps record ${record.id} with report_id: ${record.report_id}`);
                        stats.noReportFound++;
                    }
                } catch (error) {
                    console.error(`Error fixing field_of_view_gaps record ${record.id}:`, error);
                    stats.failed++;
                }
            }
            
            if (records.totalPages <= page) {
                break;
            }
            page++;
        } catch (error) {
            console.error('Error fetching field_of_view_gaps records:', error);
            break;
        }
    }
}

// Fix reverse relations in gas_reports
async function fixGasReportsRelations(pb: any, stats: any) {
    let page = 1;
    const perPage = 50;
    
    while (true) {
        try {
            // Get all reports
            const reports = await pb.collection('gas_reports').getList(page, perPage);
            
            if (reports.items.length === 0) {
                break;
            }
            
            for (const report of reports.items) {
                try {
                    // Find all field_of_view records for this report
                    const fovRecords = await pb.collection('field_of_view').getList(1, 100, {
                        filter: `report_id = "${report.report_id}"`
                    });
                    
                    // Find all field_of_view_gaps records for this report
                    const fovGapsRecords = await pb.collection('field_of_view_gaps').getList(1, 100, {
                        filter: `report_id = "${report.report_id}"`
                    });
                    
                    // Get current relations
                    const currentFov = report.field_of_view || [];
                    const currentFovGaps = report.field_of_view_gaps || [];
                    
                    // Build new relations arrays
                    const newFov = [...new Set([...currentFov, ...fovRecords.items.map((r: any) => r.id)])];
                    const newFovGaps = [...new Set([...currentFovGaps, ...fovGapsRecords.items.map((r: any) => r.id)])];
                    
                    // Update if there are new relations to add
                    if (newFov.length > currentFov.length || newFovGaps.length > currentFovGaps.length) {
                        await pb.collection('gas_reports').update(report.id, {
                            field_of_view: newFov,
                            field_of_view_gaps: newFovGaps
                        });
                        stats.fixed++;
                    }
                } catch (error) {
                    console.error(`Error fixing gas_reports record ${report.id}:`, error);
                    stats.failed++;
                }
            }
            
            if (reports.totalPages <= page) {
                break;
            }
            page++;
        } catch (error) {
            console.error('Error fetching gas_reports records:', error);
            break;
        }
    }
} 