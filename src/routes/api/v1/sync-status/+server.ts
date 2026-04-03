import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

// Total non-meta layers (100-111), used for progress calculation
const TOTAL_SYNC_LAYERS = 12;

export async function GET({ locals }: RequestEvent) {
    try {
        const pb = locals.pb;
        if (!pb) {
            return json({ error: 'PocketBase instance not available' }, { status: 500 });
        }

        try {
            // Fetch all sync_status records in one query
            const allRecords = await pb.collection('sync_status').getFullList({
                sort: 'layer_id'
            });

            // Find the overall sync record (layer_id=999)
            const overall = allRecords.find(r => r.layer_id === 999);

            // Check per-layer records for in-progress detection
            const layerRecords = allRecords.filter(r => r.layer_id !== 999);
            const inProgressLayers = layerRecords.filter(r => r.sync_status === 'in_progress');
            const completedLayers = layerRecords.filter(r => r.sync_status === 'success' || r.sync_status === 'failed');
            const isSyncing = inProgressLayers.length > 0;

            // Find the currently syncing layer name
            const currentLayer = inProgressLayers.length > 0 ? inProgressLayers[0].layer_name : null;

            // Calculate progress: how many layers have been updated more recently than
            // the in-progress layer started (i.e., completed in this sync run)
            let completedInRun = 0;
            if (isSyncing && inProgressLayers[0]) {
                const inProgressUpdated = new Date(inProgressLayers[0].updated).getTime();
                // Layers updated after the in-progress layer was set are done in this run
                completedInRun = layerRecords.filter(r =>
                    r.sync_status === 'success' &&
                    new Date(r.updated).getTime() >= inProgressUpdated
                ).length;
            }

            const response: Record<string, any> = {
                id: overall?.id || 'unknown',
                last_sync: overall?.last_sync_success || overall?.last_sync_attempt || null,
                last_sync_attempt: overall?.last_sync_attempt || null,
                last_sync_success: overall?.last_sync_success || null,
                sync_status: isSyncing ? 'in_progress' : (overall?.sync_status || 'unknown'),
                error_message: overall?.error_message || null
            };

            if (isSyncing) {
                response.syncing = {
                    currentLayer,
                    completedLayers: completedInRun,
                    totalLayers: TOTAL_SYNC_LAYERS
                };
            }

            return json(response);
        } catch (error: any) {
            if (error?.status === 404) {
                return json({
                    id: 'unknown',
                    sync_status: 'unknown',
                    last_sync: null,
                    last_sync_success: null,
                    error_message: 'No sync status records found'
                });
            }
            throw error;
        }
    } catch (error) {
        console.error('Error in sync status API:', error);
        return json({
            error: 'Failed to fetch sync status',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
