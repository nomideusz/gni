import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, fetch }) => {
	try {
		const response = await fetch(`/api/v1/shared-files?id=${params.id}`);
		
		if (!response.ok) {
			if (response.status === 404) {
				throw error(404, 'Shared file not found');
			}
			throw error(500, 'Failed to load shared file');
		}
		
		const sharedFile = await response.json();
		
		return {
			sharedFile
		};
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to load shared file');
	}
}; 