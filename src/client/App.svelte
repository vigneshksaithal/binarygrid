<script lang="ts">
	import { onMount } from 'svelte'
	import './app.css'
	import Grid from './components/Grid.svelte'
	import Timer from './components/Timer.svelte'
	import Toolbar from './components/Toolbar.svelte'
	import { loadPuzzle } from './stores/game'
	import { theme } from './stores/theme'

	onMount(() => {
		loadPuzzle('easy')
	})
</script>

<main
	class="w-full h-screen font-mono flex flex-col"
	class:bg-secondary-black={$theme === 'dark'}
	class:text-primary-green={$theme === 'dark'}
	class:bg-white={$theme === 'light'}
	class:text-green-800={$theme === 'light'}
>
	<div class="w-full h-full flex flex-col p-2 sm:p-4 lg:p-6">
		<header class="mb-4">
			<Toolbar />
		</header>
		<div class="flex-1 flex flex-col items-center justify-center gap-3">
			<div class="text-primary-green text-sm sm:text-base font-semibold">
				<Timer />
			</div>
			<Grid />
		</div>
		<footer class="text-center text-primary-green text-xs sm:text-sm mt-4">
			<span class="font-medium">Solve to reveal Today's ASCII Character</span>
		</footer>
	</div>
	<div
		class="pointer-events-none fixed inset-0 opacity-[0.15]"
		style="background-image: repeating-linear-gradient(transparent, transparent 2px, rgba(var(--color-primary-green-rgb) / 0.05) 3px);"
	></div>
</main>
