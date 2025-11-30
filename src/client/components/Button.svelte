<script lang="ts">
	import type { Snippet } from 'svelte'

	type Variant = 'default' | 'secondary'

	const {
		onClick,
		disabled = false,
		type = 'button',
		ariaLabel,
		variant = 'default',
		children,
	}: {
		onClick?: () => void
		disabled?: boolean
		type?: 'button' | 'submit' | 'reset'
		ariaLabel?: string
		variant?: Variant
		children?: Snippet
	} = $props()

	const baseClasses =
		'inline-flex items-center justify-center whitespace-nowrap px-4 py-3 text-sm font-mono font-semibold tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer border-2 disabled:cursor-not-allowed uppercase'

	const variantClasses = {
		default:
			'bg-green-300 dark:bg-green-900 text-green-800 dark:text-green-400 border-green-800 dark:border-green-400 hover:border-green-500 focus-visible:ring-green-500',
		secondary:
			'text-neutral-900 dark:text-neutral-300 border-neutral-900 dark:border-neutral-300 hover:border-neutral-900/85 focus-visible:ring-neutral-400',
	}
</script>

<button
	{type}
	class={`${baseClasses} ${variantClasses[variant]}`}
	onclick={onClick}
	{disabled}
	aria-label={ariaLabel}
>
	{@render children?.()}
</button>
