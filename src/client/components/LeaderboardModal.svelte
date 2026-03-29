<script lang="ts">
	import type { Difficulty } from '../../shared/types/puzzle'
	import type { StreakLeaderboardEntry } from '../../shared/types/streak'
	import { game } from '../stores/game'
	import { leaderboard, loadLeaderboard } from '../stores/leaderboard'
	import { formatElapsedTime } from '../stores/timer'
	import { closeLeaderboardModal, showLeaderboardModal } from '../stores/ui'
	import Modal from './Modal.svelte'

	type TabType = Difficulty | 'streaks' | 'coins'

	const TABS: { value: TabType; label: string }[] = [
		{ value: 'easy', label: '🟢 Easy' },
		{ value: 'medium', label: '🟡 Medium' },
		{ value: 'hard', label: '🔴 Hard' },
		{ value: 'streaks', label: '🔥 Streaks' },
		{ value: 'coins', label: '🪙 Coins' },
	]

	let selectedTab = $state<TabType>('medium')
	let lastLoadedPuzzleId = $state<string | null>(null)
	let currentPuzzleId = $state<string | null>(null)

	// Streak state
	let streakEntries = $state<StreakLeaderboardEntry[]>([])
	let streakPlayerEntry = $state<StreakLeaderboardEntry | null>(null)
	let isLoadingStreaks = $state(false)
	let streakLoadError = $state<string | null>(null)

	// Coins state
	type CoinEntry = { rank: number; userId: string; username: string; score: number }
	let coinEntries = $state<CoinEntry[]>([])
	let coinUserRank = $state<number | undefined>(undefined)
	let isLoadingCoins = $state(false)
	let coinLoadError = $state<string | null>(null)

	$effect(() => {
		if (!$showLeaderboardModal) return
		currentPuzzleId = $game.puzzleId
		selectedTab = $game.difficulty
	})

	const getPuzzleId = (difficulty: Difficulty): string => {
		if (currentPuzzleId?.startsWith('t3_')) {
			const parts = currentPuzzleId.split(':')
			return `${parts[0]}:${difficulty}`
		}
		const now = new Date()
		const y = now.getFullYear()
		const m = String(now.getMonth() + 1).padStart(2, '0')
		const d = String(now.getDate()).padStart(2, '0')
		return `${y}-${m}-${d}:${difficulty}`
	}

	const fetchStreaks = async () => {
		isLoadingStreaks = true
		streakLoadError = null
		try {
			const res = await fetch('/api/leaderboard/streaks')
			if (res.ok) {
				const data = await res.json()
				streakEntries = data.entries ?? []
				streakPlayerEntry = data.playerEntry ?? null
			} else {
				streakLoadError = 'Failed to load'
			}
		} catch { streakLoadError = 'Failed to load' }
		finally { isLoadingStreaks = false }
	}

	const fetchCoins = async () => {
		isLoadingCoins = true
		coinLoadError = null
		try {
			const res = await fetch('/api/leaderboard/coins')
			if (res.ok) {
				const data = await res.json()
				coinEntries = data.entries ?? []
				coinUserRank = data.userRank
			} else {
				coinLoadError = 'Failed to load'
			}
		} catch { coinLoadError = 'Failed to load' }
		finally { isLoadingCoins = false }
	}

	$effect(() => {
		if (!$showLeaderboardModal) return
		if (selectedTab === 'streaks') { fetchStreaks(); return }
		if (selectedTab === 'coins') { fetchCoins(); return }
		const puzzleId = getPuzzleId(selectedTab)
		if ($leaderboard.status === 'idle' || lastLoadedPuzzleId !== puzzleId) {
			lastLoadedPuzzleId = puzzleId
			loadLeaderboard(puzzleId, 0, 10)
		}
	})

	const medal = (rank: number) =>
		rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

	const rankColor = (rank: number) =>
		rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-zinc-300' : rank === 3 ? 'text-orange-400' : 'text-zinc-500'
</script>

<Modal
	open={$showLeaderboardModal}
	onClose={closeLeaderboardModal}
	labelledby="leaderboard-modal-title"
	describedby="leaderboard-modal-description"
>
	<section class="flex flex-col gap-3 max-h-full">
		<h2 id="leaderboard-modal-title" class="text-lg font-bold text-zinc-100">🏆 Leaderboard</h2>

		<!-- Tabs -->
		<div class="flex gap-1.5 flex-wrap">
			{#each TABS as tab}
				<button
					class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
						{selectedTab === tab.value
							? 'bg-zinc-100 text-zinc-900'
							: 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}"
					onclick={() => (selectedTab = tab.value)}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- ── SPEED tabs (easy/medium/hard) ── -->
		{#if selectedTab === 'easy' || selectedTab === 'medium' || selectedTab === 'hard'}
			{#if $leaderboard.status === 'loading'}
				<div class="flex justify-center py-8"><div class="w-5 h-5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin"></div></div>
			{:else if $leaderboard.status === 'error'}
				<p class="text-xs text-red-400 text-center py-4">{$leaderboard.error}</p>
			{:else}
				{@const state = $leaderboard}
				{#if state.playerEntry}
					<div class="bg-zinc-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
						<span class="text-xs text-zinc-400 uppercase tracking-wide">Your Rank</span>
						<span class="font-bold text-green-400 text-lg">{medal(state.playerEntry.rank)}</span>
					</div>
				{/if}
				{#if state.entries.length === 0}
					<p class="text-sm text-zinc-500 text-center py-6">No entries yet. Be the first!</p>
				{:else}
					<div class="space-y-1.5">
						{#each state.entries as entry (entry.userId)}
							<div class="flex items-center gap-3 px-3 py-2.5 rounded-xl
								{entry.userId === state.playerEntry?.userId ? 'bg-zinc-700' : 'bg-zinc-800/60'}">
								<span class="w-8 text-center font-bold text-sm {rankColor(entry.rank)}">{medal(entry.rank)}</span>
								<div class="flex items-center gap-2 flex-1 min-w-0">
									{#if entry.avatarUrl}
										<img src={entry.avatarUrl} alt="" class="w-6 h-6 rounded-full flex-shrink-0" />
									{:else}
										<div class="w-6 h-6 rounded-full bg-zinc-600 flex-shrink-0"></div>
									{/if}
									<span class="text-sm text-zinc-200 truncate">{entry.username}</span>
								</div>
								<span class="text-sm font-mono text-green-400 flex-shrink-0">{formatElapsedTime(Math.round(entry.timeSeconds))}</span>
								<span class="text-xs text-zinc-500 flex-shrink-0 w-10 text-right">{entry.attempts}x</span>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

		<!-- ── STREAKS tab ── -->
		{:else if selectedTab === 'streaks'}
			{#if isLoadingStreaks}
				<div class="flex justify-center py-8"><div class="w-5 h-5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin"></div></div>
			{:else if streakLoadError}
				<p class="text-xs text-red-400 text-center py-4">{streakLoadError}</p>
			{:else}
				{#if streakPlayerEntry}
					<div class="bg-zinc-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
						<span class="text-xs text-zinc-400 uppercase tracking-wide">Your Streak</span>
						<span class="font-bold text-orange-400 text-lg">🔥 {streakPlayerEntry.streak}</span>
					</div>
				{/if}
				{#if streakEntries.length === 0}
					<p class="text-sm text-zinc-500 text-center py-6">No streaks yet. Start playing!</p>
				{:else}
					<div class="space-y-1.5">
						{#each streakEntries as entry (entry.userId)}
							<div class="flex items-center gap-3 px-3 py-2.5 rounded-xl
								{entry.userId === streakPlayerEntry?.userId ? 'bg-zinc-700' : 'bg-zinc-800/60'}">
								<span class="w-8 text-center font-bold text-sm {rankColor(entry.rank)}">{medal(entry.rank)}</span>
								<div class="flex items-center gap-2 flex-1 min-w-0">
									{#if entry.avatarUrl}
										<img src={entry.avatarUrl} alt="" class="w-6 h-6 rounded-full flex-shrink-0" />
									{:else}
										<div class="w-6 h-6 rounded-full bg-zinc-600 flex-shrink-0"></div>
									{/if}
									<span class="text-sm text-zinc-200 truncate">{entry.username}</span>
								</div>
								<span class="text-sm font-semibold text-orange-400 flex-shrink-0">🔥 {entry.streak}</span>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

		<!-- ── COINS tab ── -->
		{:else if selectedTab === 'coins'}
			{#if isLoadingCoins}
				<div class="flex justify-center py-8"><div class="w-5 h-5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin"></div></div>
			{:else if coinLoadError}
				<p class="text-xs text-red-400 text-center py-4">{coinLoadError}</p>
			{:else}
				{#if coinUserRank !== undefined}
					<div class="bg-zinc-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
						<span class="text-xs text-zinc-400 uppercase tracking-wide">Your Rank</span>
						<span class="font-bold text-yellow-400 text-lg">{medal(coinUserRank)}</span>
					</div>
				{/if}
				{#if coinEntries.length === 0}
					<p class="text-sm text-zinc-500 text-center py-6">No coin earners yet. Solve puzzles!</p>
				{:else}
					<div class="space-y-1.5">
						{#each coinEntries as entry (entry.userId)}
							<div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/60">
								<span class="w-8 text-center font-bold text-sm {rankColor(entry.rank)}">{medal(entry.rank)}</span>
								<span class="text-sm text-zinc-200 flex-1 truncate">{entry.username}</span>
								<span class="text-sm font-bold text-yellow-400 flex-shrink-0">🪙 {entry.score}</span>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		{/if}
	</section>
</Modal>
