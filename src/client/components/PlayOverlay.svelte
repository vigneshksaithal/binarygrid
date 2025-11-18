<script lang="ts">
	import type { Difficulty } from '../../shared/types/puzzle'
	import { loadPuzzle } from '../stores/game'
	import { startTimer } from '../stores/timer'
	import { closePlayOverlay, showPlayOverlay } from '../stores/ui'
	import Button from './Button.svelte'

	const selectDifficulty = async (difficulty: Difficulty) => {
		closePlayOverlay()
		await loadPuzzle(difficulty)
		startTimer()
	}
</script>

{#if $showPlayOverlay}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-neutral-900 px-6"
	>
		<h1>Binary Grid</h1>
		<p class="text-center mb-12">
			Fill the grid with 0s and 1s,
			<br />
			following the rules.
		</p>
		<p class="mb-4">Choose Your Difficulty:</p>
		<div class="flex flex-col gap-4 w-full max-w-3xs">
			<Button
				onClick={() => selectDifficulty('easy')}
				ariaLabel="Easy difficulty"
			>
				Easy
			</Button>
			<Button
				onClick={() => selectDifficulty('medium')}
				ariaLabel="Medium difficulty"
			>
				Medium
			</Button>
			<Button
				onClick={() => selectDifficulty('hard')}
				ariaLabel="Hard difficulty"
			>
				Hard
			</Button>
		</div>
	</div>
{/if}
