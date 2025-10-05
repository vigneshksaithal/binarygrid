<script lang="ts">
import { onMount } from 'svelte'

const TIMER_INTERVAL_MS = 1000
let seconds = $state(0)

const formatElapsedTime = (elapsed: number) => {
  const minutes = Math.floor(elapsed / 60)
  const remainingSeconds = elapsed % 60

  return `Time: ${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

onMount(() => {
  const intervalId: ReturnType<typeof setInterval> = setInterval(() => {
    seconds += 1
  }, TIMER_INTERVAL_MS)

  return () => {
    clearInterval(intervalId)
  }
})
</script>

<span class="text-green-400 text-sm sm:text-base font-semibold">
  {formatElapsedTime(seconds)}
</span>
