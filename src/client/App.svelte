<script lang="ts">
import { onMount } from 'svelte'
import './app.css'
import Confetti from './components/Confetti.svelte'
import Grid from './components/Grid.svelte'
import StreakBadge from './components/StreakBadge.svelte'
import Timer from './components/Timer.svelte'
import Toolbar from './components/Toolbar.svelte'
import { game, loadPuzzle } from './stores/game'
import { loadStreak } from './stores/streak'

let shouldCelebrate = $state(false)

onMount(() => {
  loadStreak()
  loadPuzzle('easy')
})

$effect(() => {
  shouldCelebrate = $game.status === 'solved'
})
</script>

<main
	class="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 sm:gap-4 p-4 md:p-6"
>
	<Timer />
	<StreakBadge />
	<Grid />
	<Toolbar />
</main>

{#if shouldCelebrate}
	<Confetti />
{/if}
