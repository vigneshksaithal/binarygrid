<script lang="ts">
	import type { Difficulty } from '../../shared/types/puzzle'
	import { game } from '../stores/game'
	import {
		leaderboard,
		loadLeaderboard,
	} from '../stores/leaderboard'
	import { formatElapsedTime } from '../stores/timer'
	import { closeLeaderboardModal, showLeaderboardModal } from '../stores/ui'
	import Button from './Button.svelte'
	import Modal from './Modal.svelte'

	const DIFFICULTIES: { value: Difficulty; label: string }[] = [
		{ value: 'easy', label: 'Easy' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'hard', label: 'Hard' },
	]

	let selectedDifficulty = $state<Difficulty>('medium')
	let lastLoadedPuzzleId = $state<string | null>(null)
	let currentPuzzleId = $state<string | null>(null)

	$effect(() => {
		if (!$showLeaderboardModal) {
			return
		}
		currentPuzzleId = $game.puzzleId
		selectedDifficulty = $game.difficulty
	})

	const getPuzzleId = (difficulty: Difficulty): string => {
		if (currentPuzzleId?.startsWith('t3_')) {
			const parts = currentPuzzleId.split(':')
			const postId = parts[0]
			return `${postId}:${difficulty}`
		}
		const now = new Date()
		const year = now.getFullYear()
		const month = String(now.getMonth() + 1).padStart(2, '0')
		const day = String(now.getDate()).padStart(2, '0')
		return `${year}-${month}-${day}:${difficulty}`
	}

	const formatRankLabel = (rank: number) => `#${rank}`

	const handleDifficultyChange = (difficulty: Difficulty) => {
		selectedDifficulty = difficulty
	}

	$effect(() => {
		if (!$showLeaderboardModal) {
			return
		}
		const puzzleId = getPuzzleId(selectedDifficulty)
		if ($leaderboard.status === 'idle' || lastLoadedPuzzleId !== puzzleId) {
			lastLoadedPuzzleId = puzzleId
			loadLeaderboard(puzzleId, 0, 10)
		}
	})
</script>

<Modal
	open={$showLeaderboardModal}
	onClose={closeLeaderboardModal}
	labelledby="leaderboard-modal-title"
	describedby="leaderboard-modal-description"
>
	<section class="flex max-h-full flex-col gap-2 sm:gap-4">
		<h2 id="leaderboard-modal-title" class="text-base sm:text-lg font-semibold">Leaderboard</h2>

		<div class="flex gap-2 flex-wrap">
			{#each DIFFICULTIES as difficulty}
				<Button
					variant={selectedDifficulty === difficulty.value ? 'default' : 'secondary'}
					size="sm"
					onClick={() => handleDifficultyChange(difficulty.value)}
				>
					{difficulty.label}
				</Button>
			{/each}
		</div>

		{#if $leaderboard.status === 'loading'}
			<div
				class="flex flex-1 flex-col items-center justify-center gap-3 py-6 sm:py-10"
				role="status"
				aria-live="polite"
			>
				<div
					class="size-4 sm:size-6 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin"
					aria-hidden="true"
				></div>
				<p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
					Loading leaderboard…
				</p>
			</div>
		{:else if $leaderboard.status === 'error'}
			<p class="rounded-lg bg-error/10 p-3 sm:p-4 text-xs sm:text-sm text-error">
				{$leaderboard.error ?? 'Unable to load leaderboard. Please try again.'}
			</p>
		{:else}
			{@const state = $leaderboard}
			{#if state.playerEntry}
				<div
					class="border border-zinc-400/50 bg-zinc-200/30 dark:bg-zinc-800/30 p-2 sm:p-3 text-xs sm:text-sm text-zinc-800 dark:text-zinc-300 rounded-lg text-center"
				>
					<span class="uppercase tracking-wide">Your Rank:</span>
					<span class="ml-1 sm:ml-2 text-sm sm:text-lg font-bold">{formatRankLabel(state.playerEntry.rank)}</span>
				</div>
			{/if}

			{#if state.entries.length === 0}
				<p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 py-4 sm:py-8 text-center">
					No leaderboard entries yet.
				</p>
			{:else}
				<div class="overflow-x-auto -mx-2 sm:mx-0">
					<table class="w-full text-xs sm:text-sm min-w-[200px]">
						<thead>
							<tr class="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-300 dark:border-zinc-600">
								<th class="text-left py-1.5 sm:py-2 px-1.5 sm:px-2">Rank</th>
								<th class="text-left py-1.5 sm:py-2 px-1.5 sm:px-2">Player</th>
								<th class="text-right py-1.5 sm:py-2 px-1.5 sm:px-2">Time</th>
							</tr>
						</thead>
						<tbody>
							{#each state.entries as entry (entry.userId)}
								<tr
									class={`border-b border-zinc-200 dark:border-zinc-700 ${
										entry.userId === state.playerEntry?.userId
											? 'bg-zinc-200/50 dark:bg-zinc-800/50'
											: ''
									}`}
								>
									<td class="py-1.5 sm:py-2 px-1.5 sm:px-2 font-medium text-zinc-800 dark:text-zinc-200">
										{formatRankLabel(entry.rank)}
									</td>
									<td class="py-1.5 sm:py-2 px-1.5 sm:px-2 text-zinc-800 dark:text-zinc-200">
										<div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
											{#if entry.avatarUrl}
												<img
													src={entry.avatarUrl}
													alt=""
													class="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
												/>
											{:else}
												<div class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-shrink-0"></div>
											{/if}
											<span class="truncate min-w-0">{entry.username}</span>
										</div>
									</td>
									<td class="py-1.5 sm:py-2 px-1.5 sm:px-2 text-right text-zinc-800 dark:text-zinc-200">
										{formatElapsedTime(Math.round(entry.timeSeconds))}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</section>
</Modal>
