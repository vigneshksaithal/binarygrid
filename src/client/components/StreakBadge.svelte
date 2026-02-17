<script lang="ts">
	import { streakStore } from '../stores/streak'

	let currentStreak = $state(0)

	$effect(() => {
		const unsub = streakStore.subscribe(s => {
			if (s.status === 'ready') {
				currentStreak = s.data.currentStreak
			}
		})
		return unsub
	})
</script>

{#if currentStreak > 0}
	<span class="inline-flex items-center gap-0.5 text-lg font-bold text-orange-500" role="img" aria-label="{currentStreak} day streak">
		<span>🔥</span><span>{currentStreak}</span>
	</span>
{/if}
