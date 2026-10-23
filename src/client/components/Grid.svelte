<script lang="ts">
	import { SIZE } from '../../shared/rules'
	import { autosubmitIfSolved, cycleCell, game, retryPuzzleLoad } from '../stores/game'
	import Button from './Button.svelte'
	import Cell from './Cell.svelte'

	$effect(() => {
		if ($game.status === 'solved') {
			autosubmitIfSolved()
		}
	})

	// Generate skeleton cells with random animation delays for loading state
	const skeletonCells = Array.from({ length: 36 }, (_, i) => ({
		id: i,
		row: Math.floor(i / 6),
		col: i % 6,
		delay: Math.random() * 1.5, // Random [0, 1.5) seconds delay for sparkle effect
	}))
</script>

<div
	class="w-full grid grid-cols-6 border-2 border-zinc-300 dark:border-zinc-600 rounded-xl overflow-hidden"
>
	{#if $game.status === 'loading'}
		{#each skeletonCells as cell (cell.id)}
			<div
				class="skeleton-cell aspect-square bg-zinc-200 dark:bg-zinc-700 {cell.col <
				5
					? 'border-r-2 border-r-zinc-400'
					: ''} {cell.row < 5 ? 'border-b-2 border-b-zinc-400' : ''}"
				style="animation-delay: {cell.delay}s"
			></div>
		{/each}
	{:else if $game.status === 'error'}
		<div
			class="col-span-6 aspect-square flex flex-col items-center justify-center gap-4 p-6 text-center"
			role="alert"
		>
			<span class="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
				Couldn't load the puzzle.
			</span>
			<Button onClick={retryPuzzleLoad}>Retry</Button>
		</div>
	{:else}
		{#each Array.from({ length: SIZE }) as _, r (r)}
			{#each Array.from({ length: SIZE }) as __, c (c)}
				{#if $game.grid[r]}
					<Cell
						value={$game.grid[r][c] ?? null}
						fixed={$game.fixedSet.has(`${r},${c}`)}
						hasError={$game.errorCells.has(`${r},${c}`)}
						row={r}
						col={c}
						onClick={() => cycleCell(r, c)}
					/>
				{/if}
			{/each}
		{/each}
	{/if}
</div>

<style>
	@keyframes skeleton-pulse {
		0%,
		100% {
			opacity: 0.3;
		}
		50% {
			opacity: 1;
		}
	}

	.skeleton-cell {
		animation: skeleton-pulse 1.5s ease-in-out infinite;
	}
</style>
