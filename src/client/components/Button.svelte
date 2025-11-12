<script lang="ts">
	import type { Snippet } from 'svelte'

	type Variant = 'default' | 'destructive' | 'secondary'

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
		'inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed'

	const variantClasses = {
		default:
			'bg-green-500 dark:bg-green-600 text-neutral-900 dark:text-neutral-100 shadow-md hover:bg-green-600 dark:hover:bg-green-500 focus-visible:ring-green-500 shadow-md disabled:bg-green-500/50 dark:disabled:bg-green-600/50 disabled:text-neutral-600 dark:disabled:text-neutral-400 disabled:shadow-none',
		destructive:
			'bg-red-900 text-red-100 shadow-md hover:bg-red-900/85 focus-visible:ring-red-500 disabled:bg-red-900/60 disabled:text-red-600 disabled:shadow-none',
		secondary:
			'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-300 hover:opacity-80 focus-visible:ring-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed',
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
