<script lang="ts">
import { SIZE } from "../../shared/rules";
import { autosubmitIfSolved, cycleCell, game } from "../stores/game";
import Cell from "./Cell.svelte";

$effect(() => {
	if ($game.status === "solved") {
		autosubmitIfSolved();
	}
});

// Check if grid should shake
const shouldShake = $derived($game.status === "invalid");

// Generate skeleton cells with random animation delays for loading state
const skeletonCells = Array.from({ length: 36 }, (_, i) => ({
	id: i,
	row: Math.floor(i / 6),
	col: i % 6,
	delay: Math.random() * 1.5, // Random [0, 1.5) seconds delay for sparkle effect
}));
</script>

<div
	class="w-full grid grid-cols-6 border-2 border-zinc-400 rounded-xl overflow-hidden {shouldShake
		? 'shake'
		: ''}"
>
	{#if $game.status === 'solved'}
		<p class="col-span-6 text-center py-2 bg-green-100 dark:bg-green-900">
			Solved
		</p>
	{/if}
	{#if $game.status === 'loading'}
		{#each skeletonCells as cell (cell.id)}
			<div
				class="skeleton-cell aspect-square bg-zinc-300 dark:bg-zinc-700 {cell.col <
				5
					? 'border-r-2 border-r-zinc-400'
					: ''} {cell.row < 5 ? 'border-b-2 border-b-zinc-400' : ''}"
				style="animation-delay: {cell.delay}s"
			></div>
		{/each}
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
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		10%,
		30%,
		50%,
		70%,
		90% {
			transform: translateX(-4px);
		}
		20%,
		40%,
		60%,
		80% {
			transform: translateX(4px);
		}
	}

	.shake {
		animation: shake 0.4s ease-in-out;
	}

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
