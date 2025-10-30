<script lang="ts">
import { onMount } from 'svelte'
import { game, hasHintAvailable, loadPuzzle, revealHint } from '../stores/game'
import { openHowToModal } from '../stores/ui'
import Button from './Button.svelte'
import HowToPlayModal from './HowToPlayModal.svelte'
import SuccessModal from './SuccessModal.svelte'

let difficulty = $state<'easy' | 'medium' | 'hard'>('easy')
let hintDisabled = $state(true)

$effect(() => {
	const snapshot = $game
	const statusAllowsHint =
		snapshot.status === 'in_progress' || snapshot.status === 'invalid'
	hintDisabled = !(statusAllowsHint && hasHintAvailable(snapshot))
})

onMount(() => {
	loadPuzzle(difficulty)
})
</script>

<div class="flex items-center gap-2.5 sm:gap-4 max-w-lg mx-auto">
	<Button onClick={openHowToModal}>How to Play</Button>
	<Button onClick={revealHint} disabled={hintDisabled}>Hint</Button>
</div>

<HowToPlayModal />
<SuccessModal />
