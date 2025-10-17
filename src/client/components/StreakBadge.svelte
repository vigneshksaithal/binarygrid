<script lang="ts">
import { streak } from '../stores/streak'

const formatDays = (value: number): string => {
  const absolute = Math.max(0, Math.floor(value))
  const suffix = absolute === 1 ? 'day' : 'days'
  return `${absolute} ${suffix}`
}
</script>

<div class="flex items-center gap-3 sm:gap-4" aria-live="polite">
	<span class="text-sm sm:text-base font-semibold text-zinc-400">
		Daily streak: {formatDays($streak.current)}
	</span>
	<!-- {#if $streak.longest > 1}
	<span class="text-xs sm:text-sm text-zinc-400">
			Best: {formatDays($streak.longest)}
		</span>
	{/if} -->
</div>
