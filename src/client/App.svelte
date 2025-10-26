<script lang="ts">
import { onMount } from 'svelte'
import './app.css'
import Grid from './components/Grid.svelte'
import Timer from './components/Timer.svelte'
import Toolbar from './components/Toolbar.svelte'
import { loadPuzzle } from './stores/game'

onMount(() => {
	loadPuzzle('easy')
})
</script>

<main
	class="w-full max-w-md lg:max-w-lg mx-auto flex flex-col items-center gap-4 sm:gap-4 p-4 md:p-6"
>
	<div
		class="w-full flex items-center justify-center px-4 py-3 sm:px-6 sm:py-3 bg-zinc-800 rounded-2xl"
	>
		<Timer />
	</div>
	<Grid />
	<Toolbar />
</main>
