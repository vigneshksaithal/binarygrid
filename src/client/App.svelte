<script lang="ts">
  import { onMount } from 'svelte'
  import './app.css'
  import Button from './components/Button.svelte'
  import Grid from './components/Grid.svelte'
  import HowToPlayModal from './components/HowToPlayModal.svelte'
  import SuccessModal from './components/SuccessModal.svelte'
  import Timer from './components/Timer.svelte'
  import Leaderboard from './components/Leaderboard.svelte'
  import { loadPuzzle } from './stores/game'
  import { openHowToModal } from './stores/ui'

  onMount(() => {
    loadPuzzle('easy')
  })
</script>

<main class="w-full max-w-md mx-auto flex flex-col gap-4 items-center p-8">
  <div
    class="w-full flex items-center justify-between p-3 bg-zinc-800 rounded-3xl"
  >
    <Timer/>
    <Button onClick={openHowToModal}>How to Play</Button>
  </div>
  <Grid/>
  <Leaderboard/>
</main>

<HowToPlayModal/>
<SuccessModal/>
