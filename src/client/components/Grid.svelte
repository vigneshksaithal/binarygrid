<script lang="ts">
import { SIZE } from '../../shared/rules'
import { autosubmitIfSolved, cycleCell, game } from '../stores/game'
import Cell from './Cell.svelte'

$effect(() => {
  if ($game.status === 'solved') {
    autosubmitIfSolved()
  }
})
// Cleanup if needed (not critical in SPA single mount)
// onDestroy(() => unsub())
</script>

<div
	class="w-full max-w-md sm:max-w-md lg:max-w-lg grid grid-cols-6 gap-2 sm:gap-4 p-4 sm:p-6 bg-zinc-800 text-primary-green rounded-2xl"
>
	{#each Array.from({ length: SIZE }) as _, r}
		{#each Array.from({ length: SIZE }) as __, c}
			{#if $game.grid[r]}
				<Cell
					value={$game.grid[r][c] ?? null}
					fixed={$game.fixed.some((f) => f.r === r && f.c === c)}
					hasError={$game.errorLocations?.rows.includes(r) ||
						$game.errorLocations?.columns.includes(c) ||
						false}
					onClick={() => cycleCell(r, c)}
				/>
			{/if}
		{/each}
	{/each}
	{#if $game.status === 'invalid'}
		<div class="col-span-6 text-sm text-error mt-2 space-y-1">
			{#each $game.errors as error}
				<div>{error}</div>
			{/each}
		</div>
	{/if}
	{#if $game.status === 'solved'}
		<div class="col-span-6 text-sm text-primary-green mt-2 font-semibold">
			Solved
		</div>
	{/if}
	{#if $game.status === 'loading'}
		<div class="col-span-6 text-sm text-primary-green mt-2 font-medium">
			Loading…
		</div>
	{/if}
</div>
