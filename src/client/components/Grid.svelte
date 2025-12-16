<script lang="ts">
	import { SIZE } from '../../shared/rules'
	import { autosubmitIfSolved, cycleCell, game } from '../stores/game'
	import Cell from './Cell.svelte'

	$effect(() => {
		if ($game.status === 'solved') {
			autosubmitIfSolved()
		}
	})

	// Check if grid should shake
	const shouldShake = $derived($game.status === 'invalid')
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
	{#if $game.status === 'loading'}
		<p class="col-span-6 text-center">Loading…</p>
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
</style>
