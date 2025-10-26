<script lang="ts">
import RotateCcw from '@lucide/svelte/icons/rotate-ccw'
import Undo2 from '@lucide/svelte/icons/undo-2'
import { onMount } from 'svelte'
import {
	game,
	hasHintAvailable,
	loadPuzzle,
	resetPuzzle,
	revealHint,
	undoLastMove
} from '../stores/game'
import { openHowToModal } from '../stores/ui'
import Button from './Button.svelte'
import HowToPlayModal from './HowToPlayModal.svelte'
import SuccessModal from './SuccessModal.svelte'

let difficulty = $state<'easy' | 'medium' | 'hard'>('easy')
let hintDisabled = $state(true)
let undoDisabled = $state(true)

$effect(() => {
	const snapshot = $game
	const statusAllowsHint =
		snapshot.status === 'in_progress' || snapshot.status === 'invalid'
	hintDisabled = !(statusAllowsHint && hasHintAvailable(snapshot))
	undoDisabled = snapshot.history.length === 0
})

onMount(() => {
	loadPuzzle(difficulty)
})
</script>

<div class="flex items-center gap-2.5 sm:gap-4 max-w-lg mx-auto">
	<Button onClick={openHowToModal}>How to Play</Button>
	<Button onClick={revealHint} disabled={hintDisabled}>Hint</Button>
	<Button
		onClick={undoLastMove}
		disabled={undoDisabled}
		ariaLabel="Undo last move"
	>
		<Undo2 size={20} strokeWidth={2} aria-hidden="true" />
	</Button>
	<Button onClick={resetPuzzle} ariaLabel="Reset puzzle" variant="destructive">
		<RotateCcw size={20} strokeWidth={2} aria-hidden="true" />
	</Button>
</div>

<HowToPlayModal />
<SuccessModal />
