<script lang="ts">
	import { startTimer } from '../stores/timer'
	import { closePlayOverlay, showPlayOverlay } from '../stores/ui'

	const handlePlay = () => {
		closePlayOverlay()
		startTimer()
	}
</script>

{#if $showPlayOverlay}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-100/5 dark:bg-neutral-900/30 backdrop-blur-[1px]"
	>
		<button
			type="button"
			onclick={handlePlay}
			class="animate-bounce text-xl tracking-wide font-bold text-neutral-900 dark:text-neutral-100 bg-green-500/90 dark:bg-green-600/90 backdrop-blur-sm border border-green-400/30 dark:border-green-500/30 hover:bg-green-600/95 dark:hover:bg-green-500/95 rounded-full px-6 py-3 shadow-2xl shadow-green-500/30 dark:shadow-green-500/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-500 focus-visible:ring-offset-4"
			aria-label="Start playing"
		>
			PLAY
		</button>
	</div>
{/if}
