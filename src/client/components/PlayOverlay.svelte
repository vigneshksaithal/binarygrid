<script lang="ts">
	import type { Difficulty } from '../../shared/types/puzzle'
	import { loadPuzzle } from '../stores/game'
	import { startTimer } from '../stores/timer'
	import { closePlayOverlay, showPlayOverlay } from '../stores/ui'

	let playCount = $state<number | null>(null)

	const selectDifficulty = async (difficulty: Difficulty) => {
		closePlayOverlay()
		await loadPuzzle(difficulty)
		startTimer()
	}

	const fetchPlayCount = async () => {
		try {
			const res = await fetch('/api/play-count')
			if (res.ok) {
				const data = await res.json()
				playCount = data.count ?? 0
			} else {
				playCount = 0
			}
		} catch {
			playCount = 0
		}
	}

	$effect.pre(() => {
		if ($showPlayOverlay) {
			fetchPlayCount()
		}
	})

	const formatPlayCount = (count: number): string => {
		return count.toLocaleString()
	}
</script>

{#if $showPlayOverlay}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-green-50 dark:bg-green-950"
	>
		<h1 class="mb-12">Binary Grid</h1>
		<!-- <p class="mb-8">Balance the grid. Beat the clock.</p> -->
		<div class="flex flex-col gap-4 w-full max-w-3xs mb-8">
			<!-- <Button
				size="lg"
				onClick={() => selectDifficulty('easy')}
				ariaLabel="Easy difficulty"
			>
				PLAY
			</Button> -->
			<button
				class="w-full inline-flex items-center justify-center whitespace-nowrap font-mono font-semibold tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed uppercase bg-green-500 text-white px-6 py-4 animate-bounce"
				onclick={() => selectDifficulty('easy')}
				aria-label="Play"
			>
				PLAY
			</button>
		</div>
		{#if playCount === null}
			<p>Loading...</p>
		{:else}
			<p>
				[{formatPlayCount(playCount)}
				{playCount === 1 ? 'play' : 'plays'}]
			</p>
		{/if}
	</div>
{/if}
