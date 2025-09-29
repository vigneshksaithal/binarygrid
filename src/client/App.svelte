<script lang="ts">
	import './app.css'
	import Grid from './components/Grid.svelte'
	import Toolbar from './components/Toolbar.svelte'
</script>

<main class="min-h-screen bg-black text-green-400 font-mono">
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
