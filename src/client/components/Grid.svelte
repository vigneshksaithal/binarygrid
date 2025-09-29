<script lang="ts">
import { SIZE } from '../../shared/rules'
import { autosubmitIfSolved, cycleCell, game } from '../stores/game'
import Cell from './Cell.svelte'

$: if ($game.status === 'solved') {
	autosubmitIfSolved()
}
// Cleanup if needed (not critical in SPA single mount)
// onDestroy(() => unsub())
</script>

<div
	class="grid grid-cols-6 gap-1 p-2 border border-green-700 bg-black text-green-400 shadow-[0_0_25px_rgba(34,197,94,0.25)]"
>
	{#each Array.from({ length: SIZE }) as _, r}
		{#each Array.from({ length: SIZE }) as __, c}
			{#if $game.grid[r]}
				<Cell
					value={$game.grid[r][c] ?? null}
					fixed={$game.fixed.some((f) => f.r === r && f.c === c)}
					onClick={() => cycleCell(r, c)}
				/>
			{/if}
		{/each}
	{/each}
	{#if $game.status === 'invalid'}
		<div class="col-span-6 text-sm text-red-400 mt-2">
			{$game.errors[0]}
		</div>
	{/if}
	{#if $game.status === 'solved'}
		<div class="col-span-6 text-sm text-green-300 mt-2">Solved</div>
	{/if}
	{#if $game.status === 'loading'}
		<div class="col-span-6 text-sm text-green-300 mt-2">Loading…</div>
	{/if}
</div>
