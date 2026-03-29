<script lang="ts">
	import LightbulbIcon from '@lucide/svelte/icons/lightbulb'
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal'
	import TrophyIcon from '@lucide/svelte/icons/trophy'
	import Undo2Icon from '@lucide/svelte/icons/undo-2'
	import type { Difficulty } from '../shared/types/puzzle'
	import './app.css'
	import Button from './components/Button.svelte'
	import Dropdown from './components/Dropdown.svelte'
	import Grid from './components/Grid.svelte'
	import HowToPlayModal from './components/HowToPlayModal.svelte'
	import LeaderboardModal from './components/LeaderboardModal.svelte'
	import PlayOverlay from './components/PlayOverlay.svelte'
	import ShopModal from './components/ShopModal.svelte'
	import SuccessModal from './components/SuccessModal.svelte'
	import Timer from './components/Timer.svelte'
	import { game, loadPuzzle, undo, useHint } from './stores/game'
	import { canUseHint, cooldownProgress } from './stores/hint'
	import { fetchStreak } from './stores/streak'
	import { startTimer } from './stores/timer'
	import { openHowToModal, openLeaderboardModal } from './stores/ui'

	const difficultyOptions = [
		{ value: 'easy', label: 'Easy' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'hard', label: 'Hard' },
	]

	const handleDifficultyChange = async (difficulty: string) => {
		await loadPuzzle(difficulty as Difficulty)
		startTimer()
	}

	const handleHint = () => {
		if ($canUseHint) {
			useHint()
		}
	}

	// Fetch streak on mount
	fetchStreak()

	// Coin economy state
	let coinBalance = $state(0)
	let shopOpen = $state(false)
	let menuOpen = $state(false)

	$effect(() => {
		fetch('/api/economy')
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (data && typeof data.coins === 'number') {
					coinBalance = data.coins
				}
			})
			.catch(() => {})
	})

	const openShop = () => {
		menuOpen = false
		shopOpen = true
	}

	const openLeaderboard = () => {
		menuOpen = false
		openLeaderboardModal()
	}

	// SVG circle parameters for progress ring
	const RADIUS = 16
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS
</script>

<main
	class="min-h-screen flex flex-col justify-center w-full max-w-sm mx-auto p-1"
>
	<div class="p-2 bg-zinc-200/50 dark:bg-zinc-800 rounded-2xl">
		<!-- Header: left = actions, right = streak + timer + menu -->
		<div class="flex justify-between items-center mb-4">
			<!-- Left: Difficulty + Undo + Hint -->
			<div class="flex items-center gap-2">
				<Dropdown
					value={$game.difficulty}
					options={difficultyOptions}
					onChange={handleDifficultyChange}
					size="sm"
					ariaLabel="Select difficulty"
				/>
				<Button
					variant="ghost"
					size="icon"
					onClick={undo}
					disabled={$game.history.length === 0 ||
						($game.status !== 'in_progress' && $game.status !== 'invalid')}
					ariaLabel="Undo"
				>
					<Undo2Icon />
				</Button>
				<div class="relative">
					<Button
						variant="ghost"
						size="icon"
						onClick={handleHint}
						disabled={!$canUseHint || $game.status !== 'in_progress'}
						ariaLabel="Hint"
					>
						<LightbulbIcon />
						<span class="sr-only">Hint</span>
					</Button>
					{#if !$canUseHint}
						<svg
							class="absolute inset-0 pointer-events-none"
							width="36"
							height="36"
							viewBox="0 0 36 36"
						>
							<circle
								cx="18"
								cy="18"
								r={RADIUS}
								fill="none"
								stroke="currentColor"
								stroke-width="4"
								stroke-linecap="round"
								stroke-dasharray={CIRCUMFERENCE}
								stroke-dashoffset={CIRCUMFERENCE -
									(CIRCUMFERENCE * $cooldownProgress) / 100}
								transform="rotate(-90 18 18)"
								class="stroke-zinc-400 dark:stroke-zinc-400 transition-all duration-100"
							/>
						</svg>
					{/if}
				</div>
			</div>

			<!-- Right: Trophy + Timer + ⋯ menu -->
			<div class="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					onClick={openLeaderboard}
					ariaLabel="Leaderboard"
				>
					<TrophyIcon />
				</Button>
				<Timer />
				<!-- Overflow menu -->
				<div class="relative">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => (menuOpen = !menuOpen)}
						ariaLabel="More options"
					>
						<MoreHorizontalIcon />
					</Button>
					{#if menuOpen}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							class="fixed inset-0 z-10"
							onclick={() => (menuOpen = false)}
						></div>
						<div
							class="absolute right-0 top-10 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
						>
							<button
								class="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
								onclick={openShop}
							>
								<span class="text-base">🪙</span>
								<span>Shop</span>
								<span class="ml-auto text-yellow-400 font-bold text-xs">{coinBalance}</span>
							</button>
							<button
								class="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors border-t border-zinc-700"
								onclick={() => { menuOpen = false; openHowToModal() }}
							>
								<span class="text-base">❓</span>
								How to Play
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
		<Grid />
	</div>
</main>

<PlayOverlay />

<HowToPlayModal />
<SuccessModal />
<LeaderboardModal />
<ShopModal open={shopOpen} onClose={() => (shopOpen = false)} />
