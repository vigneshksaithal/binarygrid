<script lang="ts">
	import {
		EXACT_ONES_PER_LINE,
		EXACT_ZEROS_PER_LINE,
		SIZE,
	} from '../../shared/rules'
	import { autosubmitIfSolved, cycleCell, game } from '../stores/game'
	import { showAssistRails } from '../stores/ui'
	import Cell from './Cell.svelte'

	$effect(() => {
		if ($game.status === 'solved') {
			autosubmitIfSolved()
		}
	})

	// Check if grid should shake
	const shouldShake = $derived($game.status === 'invalid')

	// Generate skeleton cells with random animation delays for loading state
	const totalCells = SIZE * SIZE
	const skeletonCells = Array.from({ length: totalCells }, (_, i) => ({
		id: i,
		row: Math.floor(i / SIZE),
		col: i % SIZE,
		delay: Math.random() * 1.5, // Random [0, 1.5) seconds delay for sparkle effect
	}))

	const countRow = (row: (0 | 1 | null)[]) => {
		let zeros = 0
		let ones = 0
		for (const value of row) {
			if (value === 0) zeros++
			if (value === 1) ones++
		}
		return { zeros, ones }
	}

	const countColumn = (grid: (0 | 1 | null)[][], columnIndex: number) => {
		let zeros = 0
		let ones = 0
		for (let r = 0; r < SIZE; r++) {
			const value = grid[r]?.[columnIndex]
			if (value === 0) zeros++
			if (value === 1) ones++
		}
		return { zeros, ones }
	}

	const remainingRowCounts = $derived.by(() => {
		const rows: { zeros: number; ones: number }[] = []
		if (!$game.grid || $game.status === 'loading') {
			return rows
		}
		for (let r = 0; r < SIZE; r++) {
			const row = $game.grid[r] ?? []
			const counts = countRow(row)
			rows.push({
				zeros: Math.max(0, EXACT_ZEROS_PER_LINE - counts.zeros),
				ones: Math.max(0, EXACT_ONES_PER_LINE - counts.ones),
			})
		}
		return rows
	})

	const remainingColumnCounts = $derived.by(() => {
		const columns: { zeros: number; ones: number }[] = []
		if (!$game.grid || $game.status === 'loading') {
			return columns
		}
		for (let c = 0; c < SIZE; c++) {
			const counts = countColumn($game.grid, c)
			columns.push({
				zeros: Math.max(0, EXACT_ZEROS_PER_LINE - counts.zeros),
				ones: Math.max(0, EXACT_ONES_PER_LINE - counts.ones),
			})
		}
		return columns
	})

	const hintedCell = $derived.by(() => {
		const state = $game as unknown as {
			lastHintedCell?: { r: number; c: number; at: number } | null
		}
		const lastHint = state.lastHintedCell
		if (!lastHint) {
			return null
		}
		const elapsed = Date.now() - lastHint.at
		return elapsed < 2500 ? lastHint : null
	})
</script>

{#if $showAssistRails &&
	($game.status === 'in_progress' ||
		$game.status === 'invalid' ||
		$game.status === 'solved')}
	<div class="mb-2 grid grid-cols-6 gap-2">
		{#each remainingColumnCounts as counts, index (index)}
			<div
				class="flex flex-col items-center gap-1 rounded-full border border-zinc-300/60 bg-zinc-100/70 px-1 py-1 text-[10px] font-semibold text-zinc-700 dark:border-zinc-700/70 dark:bg-zinc-800/70 dark:text-zinc-200"
				aria-label={`Column ${index + 1} remaining: ${counts.zeros} zeros and ${counts.ones} ones`}
			>
				<div class="flex items-center gap-1 text-[9px]">
					<span class="inline-flex size-2.5 items-center justify-center rounded-full border border-zinc-500/60 text-[8px] text-zinc-600 dark:border-zinc-400/50 dark:text-zinc-300">
						0
					</span>
					<div class="flex gap-0.5">
						{#each Array.from({ length: EXACT_ZEROS_PER_LINE }) as _, dot (dot)}
							<span
								class={`size-1.5 rounded-full ${dot < counts.zeros
									? 'bg-emerald-400/70'
									: 'bg-zinc-300/70 dark:bg-zinc-600/70'}`}
							></span>
						{/each}
					</div>
				</div>
				<div class="flex items-center gap-1 text-[9px]">
					<span class="inline-flex size-2.5 items-center justify-center rounded-full border border-zinc-500/60 text-[8px] text-zinc-600 dark:border-zinc-400/50 dark:text-zinc-300">
						1
					</span>
					<div class="flex gap-0.5">
						{#each Array.from({ length: EXACT_ONES_PER_LINE }) as _, dot (dot)}
							<span
								class={`size-1.5 rounded-full ${dot < counts.ones
									? 'bg-indigo-400/70'
									: 'bg-zinc-300/70 dark:bg-zinc-600/70'}`}
							></span>
						{/each}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<div
	class="w-full grid grid-cols-6 border-2 border-zinc-300 dark:border-zinc-600 rounded-xl overflow-hidden {shouldShake
		? 'shake'
		: ''}"
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
						isHinted={Boolean(hintedCell && hintedCell.r === r && hintedCell.c === c)}
						isHintRow={Boolean(hintedCell && hintedCell.r === r)}
						isHintCol={Boolean(hintedCell && hintedCell.c === c)}
						onClick={() => cycleCell(r, c)}
					/>
				{/if}
			{/each}
		{/each}
	{/if}
</div>

{#if $showAssistRails &&
	($game.status === 'in_progress' ||
		$game.status === 'invalid' ||
		$game.status === 'solved')}
	<div class="mt-2 grid gap-2">
		{#each remainingRowCounts as counts, index (index)}
			<div
				class="flex items-center justify-between rounded-full border border-zinc-300/60 bg-zinc-100/70 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700/70 dark:bg-zinc-800/70 dark:text-zinc-200"
				aria-label={`Row ${index + 1} remaining: ${counts.zeros} zeros and ${counts.ones} ones`}
			>
				<span class="text-xs">Row {index + 1}</span>
				<div class="flex items-center gap-2">
					<div class="flex items-center gap-1">
						<span class="inline-flex size-4 items-center justify-center rounded-full border border-zinc-500/60 text-[9px] text-zinc-600 dark:border-zinc-400/50 dark:text-zinc-300">
							0
						</span>
						<div class="flex gap-0.5">
							{#each Array.from({ length: EXACT_ZEROS_PER_LINE }) as _, dot (dot)}
								<span
									class={`size-1.5 rounded-full ${dot < counts.zeros
										? 'bg-emerald-400/70'
										: 'bg-zinc-300/70 dark:bg-zinc-600/70'}`}
								></span>
							{/each}
						</div>
					</div>
					<div class="flex items-center gap-1">
						<span class="inline-flex size-4 items-center justify-center rounded-full border border-zinc-500/60 text-[9px] text-zinc-600 dark:border-zinc-400/50 dark:text-zinc-300">
							1
						</span>
						<div class="flex gap-0.5">
							{#each Array.from({ length: EXACT_ONES_PER_LINE }) as _, dot (dot)}
								<span
									class={`size-1.5 rounded-full ${dot < counts.ones
										? 'bg-indigo-400/70'
										: 'bg-zinc-300/70 dark:bg-zinc-600/70'}`}
								></span>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

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
