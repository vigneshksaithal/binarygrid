<script lang="ts">
import { onMount } from 'svelte'
import { loadPuzzle } from '../stores/game'
import { openHowToModal } from '../stores/ui'
import Button from './Button.svelte'
import HowToPlayModal from './HowToPlayModal.svelte'
import SuccessModal from './SuccessModal.svelte'

let difficulty = $state<'easy' | 'medium' | 'hard'>('easy')

onMount(() => {
	loadPuzzle(difficulty)
})
</script>

<div class="flex items-center gap-2.5 sm:gap-4 max-w-lg mx-auto">
	<Button onClick={openHowToModal}>How to Play</Button>
</div>

<HowToPlayModal />
<SuccessModal />
