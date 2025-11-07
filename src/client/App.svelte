<script lang="ts">
  import { onMount } from 'svelte'
  import './app.css'
  import HelpCircle from '@lucide/svelte/icons/help-circle'
  import Button from './components/Button.svelte'
  import Grid from './components/Grid.svelte'
  import HowToPlayModal from './components/HowToPlayModal.svelte'
  import LeaderboardModal from './components/LeaderboardModal.svelte'
  import SuccessModal from './components/SuccessModal.svelte'
  import Timer from './components/Timer.svelte'
  import { loadPuzzle } from './stores/game'
  import { openHowToModal, openLeaderboardModal } from './stores/ui'

  onMount(() => {
    loadPuzzle('easy')
  })
</script>

<main class="w-full max-w-sm mx-auto flex flex-col items-center p-6">
  <div
    class="w-full flex items-center justify-between p-3 bg-zinc-800 rounded-3xl mb-4"
  >
    <Timer/>
    <div class="flex items-center gap-2">
      <Button onClick={openLeaderboardModal}>Leaderboard</Button>
      <Button
        variant="secondary"
        onClick={openHowToModal}
        ariaLabel="How to Play"
      >
        <HelpCircle class="size-5"/>
      </Button>
    </div>
  </div>
  <Grid/>
</main>

<HowToPlayModal/>
<SuccessModal/>
<LeaderboardModal/>
