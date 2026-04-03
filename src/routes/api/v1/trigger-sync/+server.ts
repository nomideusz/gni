import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

const WEBHOOK_URL = 'https://g.zaur.app/webhook';
const WEBHOOK_SECRET = process.env.SYNC_WEBHOOK_SECRET || 'r2kkxDNPs9pkdnkTh1ZKiYniQfnVOOngPfRLiMpvqhM';

/** GET /api/v1/trigger-sync - Check sync webhook status */
export async function GET({ locals }: RequestEvent) {
    // Auth check - admin only
    if (!locals.user || !locals.isAdmin) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const response = await fetch(`${WEBHOOK_URL}/status`, {
            headers: { 'Authorization': `Bearer ${WEBHOOK_SECRET}` }
        });

        if (!response.ok) {
            return json({ error: 'Webhook server error', status: response.status }, { status: 502 });
        }

        const data = await response.json();
        return json(data);
    } catch (error) {
        return json({
            error: 'Cannot reach sync webhook server',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 502 });
    }
}

/** POST /api/v1/trigger-sync - Trigger a quick sync */
export async function POST({ locals, request }: RequestEvent) {
    // Auth check - admin only
    if (!locals.user || !locals.isAdmin) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { type = 'gni', force = false } = body as { type?: string; force?: boolean };

        if (!['gni', 'wwu'].includes(type)) {
            return json({ error: 'Invalid sync type. Use "gni" or "wwu"' }, { status: 400 });
        }

        const response = await fetch(`${WEBHOOK_URL}/trigger`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WEBHOOK_SECRET}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, force })
        });

        const data = await response.json();

        if (!response.ok) {
            return json(data, { status: response.status });
        }

        return json(data);
    } catch (error) {
        return json({
            error: 'Cannot reach sync webhook server',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 502 });
    }
}
