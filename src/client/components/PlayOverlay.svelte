<script lang="ts">
	import ZapIcon from '@lucide/svelte/icons/zap'
	import { cubicOut } from 'svelte/easing'
	import { fade, fly } from 'svelte/transition'
	import type { Difficulty } from '../../shared/types/puzzle'
	import { loadPuzzle } from '../stores/game'
	import { startTimer } from '../stores/timer'
	import { closePlayOverlay, showPlayOverlay } from '../stores/ui'
	import Circle from './Circle.svelte'
	import Line from './Line.svelte'

	let playCount = $state<number | null>(null)
	let selectedDifficulty = $state<Difficulty>('easy')

	const binaryGrid = [
		[1, 1, 0],
		[0, 1, 1],
		[1, 0, 0],
	]

	const fixedCells = [
		[true, false, true],
		[false, true, false],
		[true, false, true],
	]

	const startGame = async () => {
		closePlayOverlay()
		await loadPuzzle(selectedDifficulty)
		startTimer()
	}

	const fetchPlayCount = async () => {
		try {
			const res = await fetch('/api/play-count')
			const data = res.ok ? await res.json() : { count: 0 }
			playCount = data.count ?? 0
		} catch {
			playCount = 0
		}
	}

	$effect.pre(() => {
		if ($showPlayOverlay) {
			fetchPlayCount()
		}
	})

	const formatPlayCount = (count: number): string =>
		new Intl.NumberFormat('en', { notation: 'compact' }).format(count)
</script>

{#if $showPlayOverlay}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800"
	>
		<!-- Play Count Ribbon -->
		{#if playCount !== null && playCount > 0}
			<div
				class="absolute top-0 left-0 overflow-hidden w-48 h-52 pointer-events-none"
				in:fly={{ x: -60, y: -60, duration: 500, easing: cubicOut }}
			>
				<div
					class="absolute top-8 -left-16 w-60 -rotate-45 bg-linear-to-r from-indigo-500 to-purple-600 text-white text-lg font-bold py-2 text-center shadow-lg animate-ribbon-shimmer"
				>
					{formatPlayCount(playCount)} plays
				</div>
			</div>
		{/if}

		<!-- Decorative Binary Grid -->
		<div
			class="grid grid-cols-3 border-2 border-zinc-300 dark:border-zinc-600 rounded-xl overflow-hidden mb-6 max-w-2xs mx-auto"
			in:fade={{ duration: 600, delay: 200 }}
		>
			{#each binaryGrid as row, rowIndex (rowIndex)}
				{#each row as cell, cellIndex (`${rowIndex}-${cellIndex}`)}
					<div
						class="aspect-square flex items-center justify-center text-zinc-800 dark:text-zinc-200 {fixedCells[
							rowIndex
						]?.[cellIndex]
							? 'bg-zinc-200 dark:bg-zinc-700'
							: ''} {cellIndex < 2
							? 'border-r-2 border-r-zinc-300 dark:border-r-zinc-600'
							: ''} {rowIndex < 2
							? 'border-b-2 border-b-zinc-300 dark:border-b-zinc-600'
							: ''}"
					>
						<div class="scale-[0.4]">
							{#if cell === 1}
								<Line />
							{:else}
								<Circle />
							{/if}
						</div>
					</div>
				{/each}
			{/each}
		</div>

		<!-- Header Section -->
		<h1
			class="max-w-xs mx-auto text-5xl md:text-6xl text-center font-black bg-linear-to-r from-zinc-600 to-zinc-800 dark:from-zinc-300 dark:to-zinc-100 bg-clip-text text-transparent mb-12"
		>
			Binary Grid
		</h1>

		<!-- Call to Action - Large Play Button -->
		<div class="w-full max-w-sm">
			<button
				class="w-full relative overflow-hidden group py-6 px-8 rounded-2xl font-black text-2xl uppercase tracking-wider transition-all transform hover:scale-105 active:scale-95 shadow-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-green-500 animate-pulse-slo bg-linear-to-r from-green-500 to-emerald-600 animate-bounce duration-500"
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
		@keyframes pulse-slow {
			0%,
			100% {
				opacity: 1;
			}
			50% {
				opacity: 0.85;
			}
		}

		.animate-pulse-slow {
			animation: pulse-slow 3s ease-in-out infinite;
		}

		@keyframes ribbon-shimmer {
			0%,
			100% {
				opacity: 0.9;
			}
			50% {
				opacity: 1;
				box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
			}
		}

		.animate-ribbon-shimmer {
			animation: ribbon-shimmer 2s ease-in-out infinite;
		}
	</style>
{/if}
