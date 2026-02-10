<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up'
	import TrophyIcon from '@lucide/svelte/icons/trophy'
	import { game } from '../stores/game'
	import {
		leaderboard,
		loadLeaderboard,
		resetLeaderboard,
	} from '../stores/leaderboard'
	import { formatElapsedTime } from '../stores/timer'
	import {
		isMiniLeaderboardCollapsed,
		openLeaderboardModal,
		toggleMiniLeaderboard,
	} from '../stores/ui'
	import Button from './Button.svelte'

	let lastLoadedPuzzleId = $state<string | null>(null)
	let refreshInterval: ReturnType<typeof setInterval> | null = null

	const REFRESH_INTERVAL_MS = 30000

	const formatRankLabel = (rank: number) => `#${rank}`

	const showUserEntry = () => {
		const state = $leaderboard
		if (!state.playerEntry) {
			return false
		}
		const isInPreview = state.entries.some(
			(entry) => entry.userId === state.playerEntry?.userId,
		)
		return !isInPreview
	}

	const startAutoRefresh = () => {
		if (refreshInterval) {
			clearInterval(refreshInterval)
		}
		refreshInterval = setInterval(() => {
			const puzzleId = $game.puzzleId
			if (puzzleId && $leaderboard.status !== 'loading') {
				loadLeaderboard(puzzleId, 0)
			}
		}, REFRESH_INTERVAL_MS)
	}

	const stopAutoRefresh = () => {
		if (refreshInterval) {
			clearInterval(refreshInterval)
			refreshInterval = null
		}
	}

	$effect(() => {
		const puzzleId = $game.puzzleId
		if (!puzzleId) {
			return
		}

		if (lastLoadedPuzzleId !== puzzleId) {
			lastLoadedPuzzleId = puzzleId
			resetLeaderboard()
			loadLeaderboard(puzzleId, 0)
			startAutoRefresh()
		}
	})

	$effect(() => {
		if ($game.status === 'solved' && lastLoadedPuzzleId === $game.puzzleId) {
			loadLeaderboard($game.puzzleId, 0)
		}
	})

	$effect(() => {
		return () => {
			stopAutoRefresh()
		}
	})
</script>

<div
	class="bg-zinc-100/80 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
>
	<!-- Header -->
	<button
		class="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors"
		onclick={toggleMiniLeaderboard}
		aria-expanded={!$isMiniLeaderboardCollapsed}
	>
		<div class="flex items-center gap-2">
			<TrophyIcon class="size-4 text-amber-500" />
			<span class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
				Leaderboard
			</span>
			{#if $leaderboard.status === 'loading'}
				<div
					class="size-3 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin"
					aria-hidden="true"
				></div>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if $leaderboard.entries.length > 0}
				<span class="text-xs text-zinc-500 dark:text-zinc-400">
					{$leaderboard.totalEntries} players
				</span>
			{/if}
			{#if $isMiniLeaderboardCollapsed}
				<ChevronDownIcon class="size-4 text-zinc-500" />
			{:else}
				<ChevronUpIcon class="size-4 text-zinc-500" />
			{/if}
		</div>
	</button>

	<!-- Content -->
	{#if !$isMiniLeaderboardCollapsed}
		<div class="px-3 pb-3">
			{#if $leaderboard.status === 'error'}
				<p class="text-xs text-red-600 dark:text-red-400 py-2">
					Unable to load leaderboard
				</p>
			{:else if $leaderboard.entries.length === 0}
				<p class="text-xs text-zinc-500 dark:text-zinc-400 py-2 text-center">
					No entries yet. Be the first to solve!
				</p>
			{:else}
				<div class="space-y-1">
					{#each $leaderboard.entries as entry (entry.userId)}
						<div
							class={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
								entry.userId === $leaderboard.playerEntry?.userId
									? 'bg-amber-100/50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
									: 'hover:bg-zinc-200/30 dark:hover:bg-zinc-700/30'
							}`}
						>
							<span
								class={`font-bold w-6 text-center ${
									entry.rank <= 3
										? entry.rank === 1
											? 'text-amber-500'
											: entry.rank === 2
												? 'text-zinc-400'
												: 'text-amber-700'
										: 'text-zinc-600 dark:text-zinc-400'
								}`}
							>
								{formatRankLabel(entry.rank)}
							</span>
							<span class="flex-1 truncate text-zinc-700 dark:text-zinc-300">
								{entry.username}
							</span>
							<span class="text-zinc-500 dark:text-zinc-400 font-mono">
								{formatElapsedTime(Math.round(entry.timeSeconds))}
							</span>
						</div>
					{/each}

					{#if showUserEntry()}
						<div class="border-t border-zinc-200 dark:border-zinc-700 my-1"></div>
						<div
							class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-amber-100/50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800"
						>
							<span class="font-bold w-6 text-center text-amber-600 dark:text-amber-400">
								{formatRankLabel($leaderboard.playerEntry?.rank ?? 0)}
							</span>
							<span class="flex-1 truncate text-zinc-700 dark:text-zinc-300">
								{$leaderboard.playerEntry?.username ?? 'You'}
							</span>
							<span class="text-zinc-500 dark:text-zinc-400 font-mono">
								{formatElapsedTime(
									Math.round($leaderboard.playerEntry?.timeSeconds ?? 0),
								)}
							</span>
						</div>
					{/if}
				</div>
			{/if}

			<Button
				variant="ghost"
				size="sm"
				class="w-full mt-2 text-xs"
				onClick={openLeaderboardModal}
			>
				View Full Leaderboard
			</Button>
		</div>
	{/if}
</div>
