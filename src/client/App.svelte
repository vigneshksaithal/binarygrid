<script lang="ts">
	import './app.css'
	import Grid from './components/Grid.svelte'
	import Toolbar from './components/Toolbar.svelte'
	import { theme } from './stores/theme'
</script>

<main
	class="min-h-screen font-mono"
	class:dark-theme={$theme === 'dark'}
	class:light-theme={$theme === 'light'}
>
	<div class="max-w-xl mx-auto p-4 space-y-4">
		<header class="flex items-center justify-between">
			<h1 class="text-2xl">Binary Grid</h1>
			<Toolbar />
		</header>
		<Grid />
	</div>
	<div
		class="pointer-events-none fixed inset-0 opacity-[0.15]"
		style="background-image: repeating-linear-gradient(transparent, transparent 2px, rgba(0,255,0,0.05) 3px);"
	></div>
</main>

<style>
	.dark-theme {
		background-color: #000;
		color: #22c55e;
	}
	.light-theme {
		background-color: #fff;
		color: #166534;
	}
</style>
