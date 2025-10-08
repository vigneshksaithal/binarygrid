<script lang="ts">
import { loadPuzzle } from '../stores/game'
import { openHowTo } from '../stores/ui'
import Button from './Button.svelte'
import HowToModal from './HowToModal.svelte'

let difficulty = $state<'easy' | 'medium' | 'hard'>('medium')

const start = () => loadPuzzle(difficulty)
</script>

<div class="flex items-center gap-1 sm:gap-2 text-primary-green flex-wrap">
	<select
		bind:value={difficulty}
		onchange={start}
		class="bg-secondary-black text-primary-green border border-border-green px-1 py-1 sm:px-2 text-xs sm:text-sm font-medium"
	>
		<option value="easy">Easy</option>
		<option value="medium">Medium</option>
		<option value="hard">Hard</option>
	</select>
	<Button onClick={openHowTo}>How to Play</Button>
</div>
<HowToModal />
