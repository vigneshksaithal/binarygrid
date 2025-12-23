<script lang="ts">
	import LightbulbIcon from '@lucide/svelte/icons/lightbulb'
	import Undo2Icon from '@lucide/svelte/icons/undo-2'
	import type { Difficulty } from '../shared/types/puzzle'
	import './app.css'
	import Button from './components/Button.svelte'
	import Dropdown from './components/Dropdown.svelte'
	import Grid from './components/Grid.svelte'
	import HowToPlayModal from './components/HowToPlayModal.svelte'
	import PlayOverlay from './components/PlayOverlay.svelte'
	import SuccessModal from './components/SuccessModal.svelte'
	import Timer from './components/Timer.svelte'
	import { game, loadPuzzle, undo, useHint } from './stores/game'
	import { canUseHint, cooldownProgress } from './stores/hint'
	import { startTimer } from './stores/timer'
	import { openHowToModal } from './stores/ui'

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

	// SVG circle parameters for progress ring
	const RADIUS = 16
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS
</script>

<main
	class="min-h-screen flex flex-col justify-center w-full max-w-sm mx-auto p-1"
>
	<div class="p-2 bg-zinc-200/50 dark:bg-zinc-800 rounded-2xl">
		<div class="flex justify-between items-center mb-4">
			<div class="flex items-center gap-4">
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
			<Timer />
		</div>
		<Grid />
	</div>
	<div class="mt-4 flex justify-center">
		<Button
			variant="secondary"
			size="sm"
			onClick={openHowToModal}
			ariaLabel="How to Play"
		>
			How to Play
		</Button>
	</div>
</main>

<PlayOverlay />

<HowToPlayModal />
<SuccessModal />
