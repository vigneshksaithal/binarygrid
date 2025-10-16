<script lang="ts">
import { onMount } from 'svelte'
import {
  game,
  hasHintAvailable,
  loadPuzzle,
  resetPuzzle,
  revealHint
} from '../stores/game'
import { openHowTo } from '../stores/ui'
import Button from './Button.svelte'
import HowToPlayModal from './HowToPlayModal.svelte'
import SuccessModal from './SuccessModal.svelte'

let difficulty = $state<'easy' | 'medium' | 'hard'>('easy')
let hintDisabled = $state(true)

const start = () => loadPuzzle(difficulty)

$effect(() => {
  const snapshot = $game
  const statusAllowsHint =
    snapshot.status === 'in_progress' || snapshot.status === 'invalid'
  hintDisabled = !(statusAllowsHint && hasHintAvailable(snapshot))
})

onMount(() => {
  start()
})
</script>

<div class="flex items-center gap-2.5 sm:gap-4 max-w-lg mx-auto">
	<Button onClick={openHowTo}>How to Play</Button>
	<Button onClick={revealHint} disabled={hintDisabled}>Hint</Button>
	<Button onClick={resetPuzzle}>Reset</Button>
	<!-- <Button>Feedback</Button> -->
</div>

<HowToPlayModal />
<SuccessModal />
