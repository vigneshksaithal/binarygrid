<script lang="ts">
	import { onMount } from 'svelte'
	import './app.css'
	import Grid from './components/Grid.svelte'
	import HowToModal from './components/HowToModal.svelte'
	import Timer from './components/Timer.svelte'
	import Toolbar from './components/Toolbar.svelte'
	import { loadPuzzle } from './stores/game'
	import { theme } from './stores/theme'
	import { openHowTo } from './stores/ui'

	onMount(() => {
		loadPuzzle('medium')
	})
</script>

<main
	class="min-h-screen font-mono"
	class:dark-theme={$theme === 'dark'}
	class:light-theme={$theme === 'light'}
>
	<div class="w-full max-w-4xl mx-auto p-4 space-y-4">
		<header class="flex items-center justify-between flex-wrap gap-2">
			<div class="flex items-center gap-3">
				<h1 class="text-2xl">binary_grid@tty0:~</h1>
				<span class="text-green-400">▮</span>
			</div>
			<div class="flex items-center gap-3 flex-wrap">
				<Timer />
				<Toolbar />
				<button
					class="px-3 py-1 border border-green-700 hover:bg-green-500/10"
					on:click={openHowTo}>How to Play</button
				>
			</div>
		</header>
		<Grid />
		<footer class="text-center text-green-400 text-sm">
			Solve to reveal Today’s ASCII Character
		</footer>
	</div>
	<div
		class="pointer-events-none fixed inset-0 opacity-[0.15]"
		style="background-image: repeating-linear-gradient(transparent, transparent 2px, rgba(0,255,0,0.05) 3px);"
	></div>
</main>
<HowToModal />

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
