<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x'
	import type { Snippet } from 'svelte'
	import Button from './Button.svelte'

	const {
		open = false,
		labelledby,
		describedby,
		role = 'dialog',
		ariaModal = true,
		children,
		onClose,
	}: {
		open?: boolean
		labelledby?: string
		describedby?: string
		role?: 'dialog' | 'alertdialog'
		ariaModal?: boolean
		onClose: () => void
		children?: Snippet
	} = $props()
</script>

{#if open}
	<section
		class="fixed inset-0 z-50 flex items-center justify-center bg-green-200 dark:bg-green-950 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
	>
		<div
			class="relative w-full max-w-sm bg-green-50 dark:bg-green-950 p-4 sm:p-4 border-2 border-green-800 dark:border-green-600 max-h-[min(90dvh,42rem)] overflow-y-auto"
			{role}
			aria-modal={ariaModal}
			aria-labelledby={labelledby}
			aria-describedby={describedby}
		>
			<div class="absolute top-4 right-4">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					ariaLabel="Close"
				>
					<XIcon class="size-6" />
				</Button>
			</div>
			{@render children?.()}
		</div>
	</section>
{/if}
