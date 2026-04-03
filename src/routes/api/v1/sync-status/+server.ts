import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ locals }: RequestEvent) {
    try {
        const pb = locals.pb;
        if (!pb) {
            return json({ error: 'PocketBase instance not available' }, { status: 500 });
        }

        // Read from sync_status collection (layer_id=999 is the overall sync record)
        try {
            const record = await pb.collection('sync_status').getFirstListItem('layer_id = 999');
            return json({
                id: record.id,
                last_sync: record.last_sync_success || record.last_sync_attempt,
                last_sync_attempt: record.last_sync_attempt,
                last_sync_success: record.last_sync_success,
                sync_status: record.sync_status || 'unknown',
                error_message: record.error_message || null
            });
        } catch (error: any) {
            if (error?.status === 404) {
                return json({
                    id: 'unknown',
                    sync_status: 'unknown',
                    last_sync: null,
                    last_sync_success: null,
                    error_message: 'No sync status record found (layer_id=999)'
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
