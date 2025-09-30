<script lang="ts">
import { onMount } from 'svelte'
import './app.css'
import Button from './components/Button.svelte'
import Grid from './components/Grid.svelte'
import HowToModal from './components/HowToModal.svelte'
import Timer from './components/Timer.svelte'
import Toolbar from './components/Toolbar.svelte'
import { loadPuzzle } from './stores/game'
import { theme } from './stores/theme'
import { openHowTo } from './stores/ui'

onMount(() => {
	loadPuzzle('easy')
})
</script>

<main
	class="w-full h-screen font-mono flex flex-col"
	class:dark-theme={$theme === 'dark'}
	class:light-theme={$theme === 'light'}
>
	<div class="w-full h-full flex flex-col p-2 sm:p-4 lg:p-6">
		<header class="flex items-center justify-between flex-wrap gap-2 mb-4">
			<div class="flex items-center gap-2 sm:gap-3">
				<h1 class="text-lg sm:text-xl lg:text-2xl font-semibold">
					binary_grid@tty0:~
				</h1>
				<span class="text-green-400">▮</span>
			</div>
			<div class="flex items-center gap-2 sm:gap-3 flex-wrap">
				<Toolbar />
				<Button onClick={openHowTo}>How to Play</Button>
			</div>
		</header>
		<div class="flex-1 flex flex-col items-center justify-center gap-3">
			<div class="text-green-400 text-sm sm:text-base font-semibold">
				<Timer />
			</div>
			<Grid />
		</div>
		<footer class="text-center text-green-400 text-xs sm:text-sm mt-4">
			<span class="font-medium">Solve to reveal Today's ASCII Character</span>
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
