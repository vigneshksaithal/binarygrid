<script lang="ts">
import { onMount } from 'svelte'
import { loadPuzzle } from '../stores/game'
import { openHowTo } from '../stores/ui'
import Button from './Button.svelte'
import HowToPlayModal from './HowToPlayModal.svelte'
import SuccessModal from './SuccessModal.svelte'

let difficulty = $state<'easy' | 'medium' | 'hard'>('easy')

const start = () => loadPuzzle(difficulty)

onMount(() => {
  start()
})
</script>

<div class="flex items-center gap-2.5 sm:gap-4 max-w-lg mx-auto">
	<Button onClick={openHowTo}>How to Play</Button>
  <!-- <Button>Feedback</Button> -->
</div>

<HowToPlayModal />
<SuccessModal />
