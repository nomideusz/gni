import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'url';

const config = {
	preprocess: vitePreprocess(),
	kit: { 
		adapter: adapter(),
	}
};

export default config;
