<script lang="ts">
	import type { Snippet } from 'svelte'

	const {
		open = false,
		labelledby,
		describedby,
		role = 'dialog',
		ariaModal = true,
		backdropClass = 'fixed inset-0 z-50 grid place-items-center p-4',
		contentClass = 'w-full max-w-lg p-6 rounded-xl shadow-md bg-zinc-800',
		children,
	}: {
		open?: boolean
		labelledby?: string
		describedby?: string
		role?: 'dialog' | 'alertdialog'
		ariaModal?: boolean
		backdropClass?: string
		contentClass?: string
		onClose?: () => void
		closeOnBackdrop?: boolean
		children?: Snippet
	} = $props()
</script>

{#if open}
	<section class={backdropClass}>
		<div
			class={contentClass}
			{role}
			aria-modal={ariaModal}
			aria-labelledby={labelledby}
			aria-describedby={describedby}
		>
			{@render children?.()}
		</div>
	</section>
{/if}
