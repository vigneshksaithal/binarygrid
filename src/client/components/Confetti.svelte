<script lang="ts">
import canvasConfetti from 'canvas-confetti'
import { onDestroy, onMount } from 'svelte'

const DURATION_MS = 4500
const PARTICLES_PER_BURST = 70
const BURST_INTERVAL_MS = 400

let canvas: HTMLCanvasElement | null = null
let cleanup: (() => void) | null = null
let intervalId: number | null = null
let timeoutId: number | null = null

const fire = (confetti: ReturnType<typeof canvasConfetti.create>) => {
	confetti({
		particleCount: PARTICLES_PER_BURST,
		origin: { x: 0.25, y: 0.6 },
		spread: 70,
		startVelocity: 45,
		decay: 0.9,
		scalar: 0.9
	})
	confetti({
		particleCount: PARTICLES_PER_BURST,
		origin: { x: 0.75, y: 0.6 },
		spread: 70,
		startVelocity: 45,
		decay: 0.9,
		scalar: 0.9
	})
}

onMount(() => {
	if (!canvas) {
		return
	}
	const confetti = canvasConfetti.create(canvas, {
		resize: true,
		useWorker: true
	})

	fire(confetti)
	intervalId = window.setInterval(() => fire(confetti), BURST_INTERVAL_MS)
	timeoutId = window.setTimeout(() => {
		cleanup?.()
	}, DURATION_MS)
	cleanup = () => {
		if (intervalId) {
			window.clearInterval(intervalId)
			intervalId = null
		}
		if (timeoutId) {
			window.clearTimeout(timeoutId)
			timeoutId = null
		}
		confetti.reset()
	}
})

onDestroy(() => {
	cleanup?.()
})
</script>

<canvas
	bind:this={canvas}
	class="pointer-events-none fixed inset-0 z-40 h-full w-full"
	aria-hidden="true"
></canvas>
