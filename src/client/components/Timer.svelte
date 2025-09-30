<script lang="ts">
	import { onDestroy, onMount } from 'svelte'

	let seconds = $state(0)
	let interval: number | undefined
	onMount(() => {
		interval = setInterval(() => {
			seconds += 1
		}, 1000) as unknown as number
	})
	onDestroy(() => {
		if (interval) clearInterval(interval)
	})
	const fmt = (s: number) =>
		`Time: ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
</script>

<span class="text-green-400 text-sm sm:text-base font-semibold"
	>{fmt(seconds)}</span
>
