import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

// Sync status interface
interface SyncStatus {
    id: string;
    layer_id?: number;
    layer_name?: string;
    last_sync_attempt?: string;
    last_sync_success?: string;
    last_sync?: string;
    sync_status?: string;
    error_message?: string;
}

export async function GET({ locals }: RequestEvent) {
    try {
        // Get PocketBase instance from locals
        const pb = locals.pb;
        if (!pb) {
            return json({
                error: 'PocketBase instance not available'
            }, { status: 500 });
        }
        
        // First, try to get sync info from gas_reports collection (most accurate)
        try {
            // Get the most recent report with a last_sync entry
            const syncReports = await pb.collection('gas_reports').getList(1, 1, {
                sort: '-last_sync',
                filter: 'last_sync != ""'  // Only get reports with a last_sync value
            });
            
            if (syncReports.items.length > 0) {
                const mostRecentReport = syncReports.items[0];
                
                const syncInfo: SyncStatus = {
                    id: 'gas_reports_sync',
                    last_sync: mostRecentReport.last_sync,
                    last_sync_success: mostRecentReport.last_sync,
                    sync_status: 'success'  // Assuming if there's a last_sync, it was successful
                };
                
                console.log('Sync info found from gas_reports:', syncInfo.last_sync);
                return json(syncInfo);
            } else {
                console.log('No sync information found in gas_reports');
            }
        } catch (error) {
            console.error('Error getting sync info from gas_reports:', error);
            // Continue to fallback method
        }
        
        // Fallback: check the sync_status collection
        try {
            // Fetch all sync status records from the sync_status collection
            const syncRecords = await pb.collection('pbc_594585783').getList(1, 1, {
                sort: '-last_sync_attempt'
            });
            
            if (syncRecords.items.length > 0) {
                return json(syncRecords.items[0]);
            } else {
                return json({
                    id: 'unknown',
                    sync_status: 'unknown',
                    last_sync: null,
                    last_sync_success: null,
                    error_message: 'No sync information found'
                });
            }
        } catch (error) {
            console.error('Error fetching sync status from collection:', error);
            return json({ 
                error: 'Failed to fetch sync status',
                details: error instanceof Error ? error.message : String(error)
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Error in sync status API:', error);
        return json({ 
            error: 'Failed to fetch sync status',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
} 