<script lang="ts">
	import ZapIcon from '@lucide/svelte/icons/zap'
	import type { Difficulty } from '../../shared/types/puzzle'
	import { loadPuzzle } from '../stores/game'
	import { startTimer } from '../stores/timer'
	import { closePlayOverlay, showPlayOverlay } from '../stores/ui'
	import Button from './Button.svelte'

	let playCount = $state<number | null>(null)
	let selectedDifficulty = $state<Difficulty>('easy')

	const startGame = async () => {
		closePlayOverlay()
		await loadPuzzle(selectedDifficulty)
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

	const difficulties = [
		{ id: 'easy' as Difficulty, label: 'Easy' },
		{ id: 'medium' as Difficulty, label: 'Medium' },
		{ id: 'hard' as Difficulty, label: 'Hard' },
	]
</script>

{#if $showPlayOverlay}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800"
	>
		<!-- Header Section with Social Proof -->
		<div class="text-center mb-8 animate-fade-in">
			<h1
				class="text-5xl font-mon md:text-6xl font-black mb-3 bg-linear-to-r from-zinc-600 to-zinc-800 dark:from-zinc-300 dark:to-zinc-100 bg-clip-text text-transparent"
			>
				Binary Grid
			</h1>
			<p
				class="text-lg md:text-xl text-zinc-600 dark:text-zinc-300 font-medium mb-4"
			>
				Can you balance the grid???
			</p>
		</div>

		<!-- Difficulty Selector Cards -->
		<div class="w-full max-w-md mb-6">
			<div class="grid grid-cols-3 gap-3">
				{#each difficulties as difficulty (difficulty.id)}
					<Button
						variant={selectedDifficulty === difficulty.id
							? 'default'
							: 'secondary'}
						onClick={() => (selectedDifficulty = difficulty.id)}
						ariaLabel={`Select ${difficulty.label} difficulty`}
					>
						{difficulty.label}
					</Button>
				{/each}
			</div>
		</div>

		<!-- Call to Action - Large Play Button -->
		<div class="w-full max-w-md mb-8">
			<button
				class="w-full relative overflow-hidden group py-6 px-8 rounded-2xl font-black text-2xl uppercase tracking-wider transition-all duration-300 transform hover:scale-105 shadow-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-green-500 animate-pulse-slow"
				class:bg-linear-to-r={true}
				class:from-green-500={selectedDifficulty === 'easy'}
				class:to-emerald-600={selectedDifficulty === 'easy'}
				class:from-yellow-500={selectedDifficulty === 'medium'}
				class:to-orange-500={selectedDifficulty === 'medium'}
				class:from-red-500={selectedDifficulty === 'hard'}
				class:to-rose-600={selectedDifficulty === 'hard'}
				onclick={startGame}
				aria-label="Start game"
			>
				<!-- Animated background shine effect -->
				<div
					class="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"
				></div>

				<span
					class="relative text-white drop-shadow-lg flex items-center justify-center gap-3"
				>
					<ZapIcon class="size-8" />
					PLAY
				</span>
			</button>
		</div>
	</div>

	<style>
		@keyframes fade-in {
			from {
				opacity: 0;
				transform: translateY(-10px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		@keyframes pulse-slow {
			0%,
			100% {
				opacity: 1;
			}
			50% {
				opacity: 0.85;
			}
		}

		.animate-fade-in {
			animation: fade-in 0.6s ease-out;
		}

		.animate-pulse-slow {
			animation: pulse-slow 3s ease-in-out infinite;
		}
	</style>
{/if}
