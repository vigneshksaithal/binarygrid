<script lang="ts">
	import type { Snippet } from 'svelte'

	const {
		open = false,
		labelledby,
		describedby,
		role = 'dialog',
		ariaModal = true,
		children,
	}: {
		open?: boolean
		labelledby?: string
		describedby?: string
		role?: 'dialog' | 'alertdialog'
		ariaModal?: boolean
		onClose?: () => void
		children?: Snippet
	} = $props()
</script>

{#if open}
	<section
		class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-300/60 dark:bg-neutral-800/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
	>
		<div
			class="w-full max-w-sm rounded-xl bg-neutral-200 dark:bg-neutral-700 shadow-md p-4 sm:p-6 max-h-[min(90dvh,42rem)] overflow-y-auto"
			{role}
			aria-modal={ariaModal}
			aria-labelledby={labelledby}
			aria-describedby={describedby}
		>
			{@render children?.()}
		</div>
	</section>
{/if}
