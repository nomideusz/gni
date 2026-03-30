import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST - Fix missing relations across all collections
 * 
 * This endpoint repairs missing report relations by mapping report_id text fields
 * to actual PocketBase relation fields. It fixes:
 * 1. driving_sessions.report relation (back-link to gas_reports)
 * 2. gas_reports.driving_sessions relation (forward multi-relation)
 * 3. indications.report relation (back-link to gas_reports)
 * 4. field_of_view.report relation
 * 5. field_of_view_gaps.report relation
 * 6. gas_reports.field_of_view and gas_reports.field_of_view_gaps relations
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
        
        const results: Record<string, { fixed: number; failed: number; noReportFound?: number; alreadyOk?: number }> = {
            driving_sessions: { fixed: 0, failed: 0, noReportFound: 0, alreadyOk: 0 },
            indications: { fixed: 0, failed: 0, noReportFound: 0, alreadyOk: 0 },
            field_of_view: { fixed: 0, failed: 0, noReportFound: 0 },
            field_of_view_gaps: { fixed: 0, failed: 0, noReportFound: 0 },
            gas_reports: { fixed: 0, failed: 0, alreadyOk: 0 }
        };
        
        // Step 1: Build a lookup map of report_id -> gas_report PB id
        console.log('[API] Building report_id lookup map...');
        const reportIdMap = await buildReportIdMap(pb);
        console.log(`[API] Found ${reportIdMap.size} reports in lookup map`);
        
        // Step 2: Fix driving_sessions.report relation
        console.log('[API] Fixing driving_sessions relations...');
        await fixDrivingSessionsRelations(pb, reportIdMap, results.driving_sessions);
        
        // Step 3: Fix indications.report relation
        console.log('[API] Fixing indications relations...');
        await fixIndicationsRelations(pb, reportIdMap, results.indications);
        
        // Step 4: Fix field_of_view relations
        console.log('[API] Fixing field_of_view relations...');
        await fixCollectionRelation(pb, 'field_of_view', reportIdMap, results.field_of_view);
        
        // Step 5: Fix field_of_view_gaps relations
        console.log('[API] Fixing field_of_view_gaps relations...');
        await fixCollectionRelation(pb, 'field_of_view_gaps', reportIdMap, results.field_of_view_gaps);
        
        // Step 6: Fix gas_reports forward relations (driving_sessions, field_of_view, field_of_view_gaps)
        console.log('[API] Fixing gas_reports forward relations...');
        await fixGasReportsRelations(pb, results.gas_reports);
        
        console.log('[API] All relation fixes completed:', JSON.stringify(results, null, 2));
        
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

/**
 * Build a lookup map: report_id (text) -> PocketBase record id
 * This avoids repeated queries for the same report_id
 */
async function buildReportIdMap(pb: any): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    let page = 1;
    const perPage = 200;
    
    while (true) {
        const reports = await pb.collection('gas_reports').getList(page, perPage, {
            fields: 'id,report_id',
            filter: 'report_id != ""'
        });
        
        for (const report of reports.items) {
            map.set(report.report_id, report.id);
        }
        
        if (reports.totalPages <= page) break;
        page++;
    }
    
    return map;
}

/**
 * Fix driving_sessions.report relation using report_id text field
 */
async function fixDrivingSessionsRelations(pb: any, reportIdMap: Map<string, string>, stats: any) {
    let page = 1;
    const perPage = 100;
    
    while (true) {
        try {
            // Get driving_sessions that have report_id but no report relation
            const records = await pb.collection('driving_sessions').getList(page, perPage, {
                filter: 'report_id != "" && report = ""',
                fields: 'id,report_id,report'
            });
            
            if (records.items.length === 0) break;
            
            for (const record of records.items) {
                try {
                    const reportPbId = reportIdMap.get(record.report_id);
                    
                    if (reportPbId) {
                        await pb.collection('driving_sessions').update(record.id, {
                            report: reportPbId
                        });
                        stats.fixed++;
                        if (stats.fixed % 20 === 0) {
                            console.log(`[API] Fixed ${stats.fixed} driving_sessions records...`);
                        }
                    } else {
                        console.warn(`[API] No report found for driving_session ${record.id} with report_id: ${record.report_id}`);
                        stats.noReportFound++;
                    }
                } catch (error) {
                    console.error(`[API] Error fixing driving_session ${record.id}:`, error);
                    stats.failed++;
                }
            }
            
            if (records.totalPages <= page) break;
            page++;
        } catch (error) {
            console.error('[API] Error fetching driving_sessions:', error);
            break;
        }
    }
    
    console.log(`[API] Driving sessions fix: ${stats.fixed} fixed, ${stats.noReportFound} no report found, ${stats.failed} failed`);
}

/**
 * Fix indications.report relation using report_id text field
 */
async function fixIndicationsRelations(pb: any, reportIdMap: Map<string, string>, stats: any) {
    let page = 1;
    const perPage = 100;
    
    while (true) {
        try {
            // Get indications that have report_id but no report relation
            const records = await pb.collection('indications').getList(page, perPage, {
                filter: 'report_id != "" && report = ""',
                fields: 'id,report_id,report'
            });
            
            if (records.items.length === 0) break;
            
            for (const record of records.items) {
                try {
                    const reportPbId = reportIdMap.get(record.report_id);
                    
                    if (reportPbId) {
                        await pb.collection('indications').update(record.id, {
                            report: reportPbId
                        });
                        stats.fixed++;
                        if (stats.fixed % 20 === 0) {
                            console.log(`[API] Fixed ${stats.fixed} indications records...`);
                        }
                    } else {
                        console.warn(`[API] No report found for indication ${record.id} with report_id: ${record.report_id}`);
                        stats.noReportFound++;
                    }
                } catch (error) {
                    console.error(`[API] Error fixing indication ${record.id}:`, error);
                    stats.failed++;
                }
            }
            
            if (records.totalPages <= page) break;
            page++;
        } catch (error) {
            console.error('[API] Error fetching indications:', error);
            break;
        }
    }
    
    console.log(`[API] Indications fix: ${stats.fixed} fixed, ${stats.noReportFound} no report found, ${stats.failed} failed`);
}

/**
 * Generic fix for collections with report_id text and report relation fields
 * (field_of_view, field_of_view_gaps)
 */
async function fixCollectionRelation(pb: any, collectionName: string, reportIdMap: Map<string, string>, stats: any) {
    let page = 1;
    const perPage = 100;
    
    while (true) {
        try {
            const records = await pb.collection(collectionName).getList(page, perPage, {
                filter: 'report_id != "" && report = ""',
                fields: 'id,report_id,report'
            });
            
            if (records.items.length === 0) break;
            
            for (const record of records.items) {
                try {
                    const reportPbId = reportIdMap.get(record.report_id);
                    
                    if (reportPbId) {
                        await pb.collection(collectionName).update(record.id, {
                            report: reportPbId
                        });
                        stats.fixed++;
                    } else {
                        console.warn(`[API] No report found for ${collectionName} record ${record.id} with report_id: ${record.report_id}`);
                        stats.noReportFound++;
                    }
                } catch (error) {
                    console.error(`[API] Error fixing ${collectionName} record ${record.id}:`, error);
                    stats.failed++;
                }
            }
            
            if (records.totalPages <= page) break;
            page++;
        } catch (error) {
            console.error(`[API] Error fetching ${collectionName}:`, error);
            break;
        }
    }
    
    console.log(`[API] ${collectionName} fix: ${stats.fixed} fixed, ${stats.noReportFound} no report found, ${stats.failed} failed`);
}

/**
 * Fix gas_reports forward relations:
 * - driving_sessions: find all driving_sessions with matching report_id and add to the array
 * - field_of_view: find all field_of_view with matching report_id and add to the array
 * - field_of_view_gaps: find all field_of_view_gaps with matching report_id and add to the array
 */
async function fixGasReportsRelations(pb: any, stats: any) {
    let page = 1;
    const perPage = 50;
    
    while (true) {
        try {
            const reports = await pb.collection('gas_reports').getList(page, perPage, {
                fields: 'id,report_id,driving_sessions,field_of_view,field_of_view_gaps',
                filter: 'report_id != ""'
            });
            
            if (reports.items.length === 0) break;
            
            for (const report of reports.items) {
                try {
                    let needsUpdate = false;
                    const updateData: any = {};
                    
                    // Fix driving_sessions forward relation
                    const dsRecords = await pb.collection('driving_sessions').getList(1, 100, {
                        filter: `report_id = "${report.report_id}"`,
                        fields: 'id'
                    });
                    
                    const currentDs = report.driving_sessions || [];
                    const newDs = [...new Set([...currentDs, ...dsRecords.items.map((r: any) => r.id)])];
                    if (newDs.length > currentDs.length) {
                        updateData.driving_sessions = newDs;
                        needsUpdate = true;
                    }
                    
                    // Fix field_of_view forward relation
                    const fovRecords = await pb.collection('field_of_view').getList(1, 200, {
                        filter: `report_id = "${report.report_id}"`,
                        fields: 'id'
                    });
                    
                    const currentFov = report.field_of_view || [];
                    const newFov = [...new Set([...currentFov, ...fovRecords.items.map((r: any) => r.id)])];
                    if (newFov.length > currentFov.length) {
                        updateData.field_of_view = newFov;
                        needsUpdate = true;
                    }
                    
                    // Fix field_of_view_gaps forward relation
                    const fovGapsRecords = await pb.collection('field_of_view_gaps').getList(1, 200, {
                        filter: `report_id = "${report.report_id}"`,
                        fields: 'id'
                    });
                    
                    const currentFovGaps = report.field_of_view_gaps || [];
                    const newFovGaps = [...new Set([...currentFovGaps, ...fovGapsRecords.items.map((r: any) => r.id)])];
                    if (newFovGaps.length > currentFovGaps.length) {
                        updateData.field_of_view_gaps = newFovGaps;
                        needsUpdate = true;
                    }
                    
                    if (needsUpdate) {
                        await pb.collection('gas_reports').update(report.id, updateData);
                        stats.fixed++;
                        if (stats.fixed % 10 === 0) {
                            console.log(`[API] Fixed ${stats.fixed} gas_reports records...`);
                        }
                    } else {
                        stats.alreadyOk!++;
                    }
                } catch (error) {
                    console.error(`[API] Error fixing gas_reports record ${report.id}:`, error);
                    stats.failed++;
                }
            }
            
            if (reports.totalPages <= page) break;
            page++;
        } catch (error) {
            console.error('[API] Error fetching gas_reports:', error);
            break;
        }
    }
    
    console.log(`[API] Gas reports fix: ${stats.fixed} fixed, ${stats.alreadyOk} already ok, ${stats.failed} failed`);
}
