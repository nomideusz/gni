/**
 * Migration to fix missing report relations in field_of_view and field_of_view_gaps collections
 * 
 * This script:
 * 1. Finds all field_of_view records with report_id but no report relation
 * 2. Finds all field_of_view_gaps records with report_id but no report relation
 * 3. Updates them to link to the correct report in gas_reports collection
 * 
 * Run this in PocketBase Admin UI > Settings > Execute JavaScript
 */

// Fix field_of_view relations
async function fixFieldOfViewRelations(pb) {
    console.log('Starting field_of_view relations fix...');
    
    let fixed = 0;
    let failed = 0;
    let page = 1;
    const perPage = 100;
    
    try {
        while (true) {
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
                        fixed++;
                        
                        if (fixed % 10 === 0) {
                            console.log(`Fixed ${fixed} field_of_view records...`);
                        }
                    } else {
                        console.warn(`No report found for field_of_view record ${record.id} with report_id: ${record.report_id}`);
                        failed++;
                    }
                } catch (error) {
                    console.error(`Error fixing field_of_view record ${record.id}:`, error);
                    failed++;
                }
            }
            
            if (records.totalPages <= page) {
                break;
            }
            page++;
        }
        
        console.log(`Field of View fix complete: ${fixed} fixed, ${failed} failed`);
    } catch (error) {
        console.error('Error in fixFieldOfViewRelations:', error);
    }
}

// Fix field_of_view_gaps relations
async function fixFieldOfViewGapsRelations(pb) {
    console.log('Starting field_of_view_gaps relations fix...');
    
    let fixed = 0;
    let failed = 0;
    let page = 1;
    const perPage = 100;
    
    try {
        while (true) {
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
                        fixed++;
                        
                        if (fixed % 10 === 0) {
                            console.log(`Fixed ${fixed} field_of_view_gaps records...`);
                        }
                    } else {
                        console.warn(`No report found for field_of_view_gaps record ${record.id} with report_id: ${record.report_id}`);
                        failed++;
                    }
                } catch (error) {
                    console.error(`Error fixing field_of_view_gaps record ${record.id}:`, error);
                    failed++;
                }
            }
            
            if (records.totalPages <= page) {
                break;
            }
            page++;
        }
        
        console.log(`Field of View Gaps fix complete: ${fixed} fixed, ${failed} failed`);
    } catch (error) {
        console.error('Error in fixFieldOfViewGapsRelations:', error);
    }
}

// Also fix the reverse relations in gas_reports if needed
async function fixGasReportsRelations(pb) {
    console.log('Starting gas_reports relations fix...');
    
    let fixed = 0;
    let failed = 0;
    let page = 1;
    const perPage = 50;
    
    try {
        while (true) {
            // Get all reports
            const reports = await pb.collection('gas_reports').getList(page, perPage, {
                expand: 'field_of_view,field_of_view_gaps'
            });
            
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
                    const newFov = [...new Set([...currentFov, ...fovRecords.items.map(r => r.id)])];
                    const newFovGaps = [...new Set([...currentFovGaps, ...fovGapsRecords.items.map(r => r.id)])];
                    
                    // Update if there are new relations to add
                    if (newFov.length > currentFov.length || newFovGaps.length > currentFovGaps.length) {
                        await pb.collection('gas_reports').update(report.id, {
                            field_of_view: newFov,
                            field_of_view_gaps: newFovGaps
                        });
                        fixed++;
                        
                        if (fixed % 10 === 0) {
                            console.log(`Fixed ${fixed} gas_reports records...`);
                        }
                    }
                } catch (error) {
                    console.error(`Error fixing gas_reports record ${report.id}:`, error);
                    failed++;
                }
            }
            
            if (reports.totalPages <= page) {
                break;
            }
            page++;
        }
        
        console.log(`Gas Reports fix complete: ${fixed} fixed, ${failed} failed`);
    } catch (error) {
        console.error('Error in fixGasReportsRelations:', error);
    }
}

// Main migration function
async function runMigration() {
    console.log('=== Starting Field of View Relations Migration ===');
    const startTime = Date.now();
    
    try {
        // Fix field_of_view relations
        await fixFieldOfViewRelations($app.dao().db);
        
        // Fix field_of_view_gaps relations
        await fixFieldOfViewGapsRelations($app.dao().db);
        
        // Fix reverse relations in gas_reports
        await fixGasReportsRelations($app.dao().db);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`=== Migration completed in ${duration} seconds ===`);
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}

// Execute the migration
runMigration(); 