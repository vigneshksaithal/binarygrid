<script lang="ts">
import { game } from '../stores/game'
import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
</script>

<span class="text-primary-green text-sm sm:text-base font-semibold text-center">
	{#if $game.status === 'idle'}
		Time: --:--
	{:else}
		Time: {formatElapsedTime($elapsedSeconds)}
	{/if}
</span>
