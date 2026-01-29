<script lang="ts">
	import type { Difficulty, Grid } from '../../shared/types/puzzle'
	import { formatTime } from '../../shared/share-formatter'

	const {
		grid,
		dayNumber,
		completionTime,
		difficulty,
	}: {
		grid: Grid
		dayNumber: number
		completionTime: number
		difficulty: Difficulty
	} = $props()

	/**
	 * Difficulty display labels with proper capitalization.
	 */
	const DIFFICULTY_LABELS: Record<Difficulty, string> = {
		easy: 'Easy',
		medium: 'Medium',
		hard: 'Hard',
	}

	/**
	 * Formats the day number header.
	 */
	const header = $derived(`Binary Grid #${dayNumber}`)

	/**
	 * Formats the completion time.
	 */
	const formattedTime = $derived(formatTime(completionTime))

	/**
	 * Gets the difficulty label.
	 */
	const difficultyLabel = $derived(DIFFICULTY_LABELS[difficulty])
</script>

<div
	class="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-4 border-2 border-zinc-300 dark:border-zinc-600"
>
	<!-- Header with day number -->
	<div class="text-center mb-3">
		<h3 class="text-lg font-bold text-zinc-800 dark:text-zinc-100">
			{header} 🧩
		</h3>
	</div>

	<!-- Time and difficulty row -->
	<div
		class="flex items-center justify-center gap-4 text-sm text-zinc-600 dark:text-zinc-400 mb-4"
	>
		<span class="flex items-center gap-1">
			<span>⏱️</span>
			<span class="font-semibold">{formattedTime}</span>
		</span>
		<span class="text-zinc-400 dark:text-zinc-500">|</span>
		<span class="flex items-center gap-1">
			<span>🎯</span>
			<span class="font-semibold">{difficultyLabel}</span>
		</span>
	</div>

	<!-- Spoiler-free grid -->
	<div class="flex justify-center">
		<div class="grid grid-cols-6 gap-0.5">
			{#each grid as row, rowIndex (rowIndex)}
				{#each row as cell, colIndex (colIndex)}
					<div
						class="w-5 h-5 rounded-sm {cell === 0
							? 'bg-zinc-200 dark:bg-zinc-300 border border-zinc-300 dark:border-zinc-400'
							: cell === 1
								? 'bg-green-500 dark:bg-green-600 border border-green-600 dark:border-green-700'
								: 'bg-zinc-400 dark:bg-zinc-600 border border-zinc-500 dark:border-zinc-700'}"
						aria-label={cell === 0 ? 'Zero' : cell === 1 ? 'One' : 'Empty'}
					></div>
				{/each}
			{/each}
		</div>
	</div>

	<!-- Footer with play link -->
	<div class="text-center mt-4">
		<p class="text-xs text-zinc-500 dark:text-zinc-400">Play at r/binarygrid</p>
	</div>
</div>
