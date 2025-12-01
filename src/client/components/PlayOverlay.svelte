<script lang="ts">
	import type { Difficulty } from '../../shared/types/puzzle'
	import { loadPuzzle } from '../stores/game'
	import { startTimer } from '../stores/timer'
	import { closePlayOverlay, showPlayOverlay } from '../stores/ui'
	import Button from './Button.svelte'

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
		class="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-green-200 dark:bg-green-950"
	>
		<h1 class="mb-8">Binary Grid</h1>
		<p class="mb-4">> Select Difficulty:</p>
		<div class="flex flex-col gap-4 w-full max-w-3xs mb-8">
			<Button
				size="lg"
				onClick={() => selectDifficulty('easy')}
				ariaLabel="Easy difficulty"
			>
				Easy
			</Button>
			<Button
				size="lg"
				onClick={() => selectDifficulty('medium')}
				ariaLabel="Medium difficulty"
			>
				Medium
			</Button>
			<Button
				size="lg"
				onClick={() => selectDifficulty('hard')}
				ariaLabel="Hard difficulty"
			>
				Hard
			</Button>
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
