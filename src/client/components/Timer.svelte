<script lang="ts">
	import { onMount } from 'svelte'
	import { game } from '../stores/game'

	const TIMER_INTERVAL_MS = 1000
	let seconds = $state(0)
	let intervalId: ReturnType<typeof setInterval> | null = null

	const formatElapsedTime = (elapsed: number) => {
		const minutes = Math.floor(elapsed / 60)
		const remainingSeconds = elapsed % 60

		return `Time: ${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
	}

	onMount(() => {
		intervalId = setInterval(() => {
			seconds += 1
		}, TIMER_INTERVAL_MS)

		return () => {
			if (intervalId) {
				clearInterval(intervalId)
			}
		}
	})

	// Stop timer when puzzle is solved
	$effect(() => {
		const currentGame = $game
		if (currentGame.status === 'solved' && intervalId) {
			clearInterval(intervalId)
			intervalId = null
		}
	})
</script>

<span class="text-primary-green text-sm sm:text-base font-semibold">
	{formatElapsedTime(seconds)}
</span>
