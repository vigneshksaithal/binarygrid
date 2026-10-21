import { devvit } from '@devvit/start/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    devvit(),
    svelte({ configFile: 'src/client/svelte.config.js' }),
    tailwindcss()
  ]
})
