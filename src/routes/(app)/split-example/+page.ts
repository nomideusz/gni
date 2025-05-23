import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	return {
		title: 'Split Pane Examples',
		description: 'Examples of different split pane layouts and configurations'
	};
}; 