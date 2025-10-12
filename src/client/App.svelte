<script lang="ts">
import { onMount } from 'svelte'
import './app.css'
// import AnnouncementBar from './components/AnnouncementBar.svelte'
import Grid from './components/Grid.svelte'
import Timer from './components/Timer.svelte'
import Toolbar from './components/Toolbar.svelte'
import { loadPuzzle } from './stores/game'

onMount(() => {
  loadPuzzle('easy')
})
</script>

<main
	class="w-full max-w-2xl mx-auto flex flex-col items-center gap-2 sm:gap-4 py-4 sm:py-6"
>
	<Toolbar />
	<Timer />
	<Grid />
	<!-- <AnnouncementBar
		text="This is in Alpha stage. Please give your feedback here >> https://tally.so/r/wzPvga"
	/> -->
</main>
