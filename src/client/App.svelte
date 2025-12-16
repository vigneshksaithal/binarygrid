<script lang="ts">
	import InfoIcon from '@lucide/svelte/icons/info'
	import LightbulbIcon from '@lucide/svelte/icons/lightbulb'
	import TrophyIcon from '@lucide/svelte/icons/trophy'
	import Undo2Icon from '@lucide/svelte/icons/undo-2'
	import './app.css'
	import Button from './components/Button.svelte'
	import Grid from './components/Grid.svelte'
	import HowToPlayModal from './components/HowToPlayModal.svelte'
	import LeaderboardModal from './components/LeaderboardModal.svelte'
	import PlayOverlay from './components/PlayOverlay.svelte'
	import SuccessModal from './components/SuccessModal.svelte'
	import Timer from './components/Timer.svelte'
	import { game, undo, useHint } from './stores/game'
	import { canUseHint, cooldownProgress } from './stores/hint'
	import {
		openHowToModal,
		openLeaderboardModal,
		openPlayOverlay,
	} from './stores/ui'

	$effect.pre(() => {
		openPlayOverlay()
	})

	const handleHint = () => {
		if ($canUseHint) {
			useHint()
		}
	}

	// SVG circle parameters for progress ring
	const radius = 16
	const circumference = 2 * Math.PI * radius
</script>

<main
	class="min-h-screen flex flex-col justify-center w-full max-w-sm mx-auto p-2"
>
	<div class="flex justify-between items-center mb-4">
		<div class="flex items-center gap-2">
			<Button
				variant="ghost"
				size="icon"
				onClick={openHowToModal}
				ariaLabel="How to Play"
			>
				<InfoIcon />
				<span class="sr-only">How to Play</span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onClick={openLeaderboardModal}
				ariaLabel="Leaderboard"
			>
				<TrophyIcon />
				<span class="sr-only">Leaderboard</span>
			</Button>
			<div class="relative">
				<Button
					variant="ghost"
					size="icon"
					onClick={handleHint}
					disabled={!$canUseHint || $game.status === 'solved'}
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
							r={radius}
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-dasharray={circumference}
							stroke-dashoffset={circumference - (circumference * $cooldownProgress) / 100}
							transform="rotate(-90 18 18)"
							class="text-green-500 dark:text-green-400 transition-all duration-100"
						/>
					</svg>
				{/if}
			</div>
			<Button
				variant="ghost"
				size="icon"
				onClick={undo}
				disabled={$game.history.length === 0 || $game.status === 'solved'}
				ariaLabel="Undo"
			>
				<Undo2Icon />
			</Button>
		</div>
		<Timer />
	</div>
	<Grid />
</main>

<PlayOverlay />
<HowToPlayModal />
<SuccessModal />
<LeaderboardModal />
