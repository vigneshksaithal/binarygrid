<script lang="ts">
	import { SIZE } from '../../shared/rules'
	import { autosubmitIfSolved, cycleCell, game } from '../stores/game'
	import Cell from './Cell.svelte'

	$effect(() => {
		if ($game.status === 'solved') {
			autosubmitIfSolved()
		}
	})

	// Pre-compute error sets for O(1) lookups instead of O(n) .includes() calls
	const errorRowSet = $derived(new Set($game.errorLocations?.rows ?? []))
	const errorColSet = $derived(new Set($game.errorLocations?.columns ?? []))
</script>

<div class="w-full grid grid-cols-6 gap-0.5">
	{#if $game.status === 'solved'}
		<p class="col-span-6 text-center">Solved</p>
	{/if}
	{#each Array.from({ length: SIZE }) as _, r}
		{#each Array.from({ length: SIZE }) as __, c}
			{#if $game.grid[r]}
				<Cell
					value={$game.grid[r][c] ?? null}
					fixed={$game.fixedSet.has(`${r},${c}`)}
					hasError={errorRowSet.has(r) || errorColSet.has(c)}
					onClick={() => cycleCell(r, c)}
				/>
			{/if}
		{/each}
	{/each}
	{#if $game.status === 'invalid'}
		<div
			class="col-span-6 text-sm text-error mt-2 space-y-1 bg-error/10 p-3 rounded-lg"
		>
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.008a1 1 0 110 2H10a1 1 0 01-1-1z"
						clip-rule="evenodd"
					/>
				</svg>
				<div class="space-y-1">
					{#each $game.errors as error}
						<div>{error}</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
	{#if $game.status === 'loading'}
		<p class="col-span-6 text-center">Loading…</p>
	{/if}
</div>
