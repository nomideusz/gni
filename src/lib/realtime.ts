import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { pb } from '$lib/pocketbase';

export interface RealtimeState {
	connected: boolean;
	eventCount: number;
	lastEvent: string | null;
	lastEventTime: Date | null;
}

const initialState: RealtimeState = {
	connected: false,
	eventCount: 0,
	lastEvent: null,
	lastEventTime: null,
};

export const realtimeStore = writable<RealtimeState>(initialState);

// Callbacks registered by pages for auto-refresh
const refreshCallbacks = new Set<() => void>();

let subscribed = false;
let unsubscribes: (() => void)[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh() {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		console.log('Real-time: triggering refresh callbacks');
		refreshCallbacks.forEach(cb => {
			try { cb(); } catch (e) { console.error('Refresh callback error:', e); }
		});
	}, 3000);
}

export function setupRealtime() {
	if (!browser || !pb || subscribed) return;
	const client = pb;
	subscribed = true;

	const collections = ['gas_reports', 'driving_sessions', 'breadcrumbs', 'indications'];

	collections.forEach(async (collection) => {
		try {
			await client.collection(collection).subscribe('*', (e) => {
				const now = new Date();
				realtimeStore.update(s => ({
					...s,
					connected: true,
					eventCount: s.eventCount + 1,
					lastEvent: `${e.action} in ${collection}`,
					lastEventTime: now,
				}));
				console.log(`Real-time [${collection}]: ${e.action}`, e.record?.id);
				scheduleRefresh();
			});
			realtimeStore.update(s => ({ ...s, connected: true }));
			unsubscribes.push(() => client.collection(collection).unsubscribe('*'));
			console.log(`Real-time: subscribed to ${collection}`);
		} catch (err) {
			console.warn(`Real-time: failed to subscribe to ${collection}:`, err);
		}
	});
}

export function teardownRealtime() {
	unsubscribes.forEach(unsub => {
		try { unsub(); } catch { /* ignore */ }
	});
	unsubscribes = [];
	subscribed = false;
	realtimeStore.set(initialState);
	if (debounceTimer) clearTimeout(debounceTimer);
}

/** Register a callback that fires when new data arrives (debounced). Returns unregister fn. */
export function onRealtimeRefresh(cb: () => void): () => void {
	refreshCallbacks.add(cb);
	return () => { refreshCallbacks.delete(cb); };
}

/** Trigger a manual refresh of all registered callbacks */
export function manualRefresh() {
	if (debounceTimer) clearTimeout(debounceTimer);
	refreshCallbacks.forEach(cb => {
		try { cb(); } catch (e) { console.error('Refresh callback error:', e); }
	});
}
