<script lang="ts">
import { streak } from '../stores/streak'

const formatDays = (value: number): string => {
  const absolute = Math.max(0, Math.floor(value))
  const suffix = absolute === 1 ? 'day' : 'days'
  return `${absolute} ${suffix}`
}
</script>

<section
	class="w-full max-w-lg flex items-center justify-center gap-4 p-3 rounded-xl bg-zinc-800 text-zinc-200 shadow-sm"
	aria-live="polite"
>
	<span class="text-sm sm:text-base font-semibold text-primary-green">
		Daily streak: {formatDays($streak.current)}
	</span>
	<span class="text-xs sm:text-sm text-zinc-400">
		Best: {formatDays($streak.longest)}
	</span>
</section>
