import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	build: {
		outDir: '../../dist/client',
		rollupOptions: {
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: '[name].js',
				assetFileNames: '[name][extname]',
				sourcemapFileNames: '[name].js.map'
			}
		}
	}
})
