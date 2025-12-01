<script lang="ts">
	import type { Snippet } from 'svelte'

	type Variant = 'default' | 'secondary' | 'ghost'
	type Size = 'sm' | 'default' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'

	const {
		onClick,
		disabled = false,
		type = 'button',
		ariaLabel,
		variant = 'default',
		size = 'default',
		children,
	}: {
		onClick?: () => void
		disabled?: boolean
		type?: 'button' | 'submit' | 'reset'
		ariaLabel?: string
		variant?: Variant
		size?: Size
		children?: Snippet
	} = $props()

	const baseClasses =
		'inline-flex items-center justify-center whitespace-nowrap font-mono font-semibold tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer border-2 disabled:cursor-not-allowed uppercase'

	const sizeClasses = {
		sm: 'h-8 px-3 text-sm gap-1.5',
		default: 'px-4 py-3 text-sm',
		lg: 'h-10 px-6 text-base',
		icon: 'size-9 p-0',
		'icon-sm': 'size-8 p-0',
		'icon-lg': 'size-10 p-0',
	}

	const variantClasses = {
		default:
			'bg-green-300 dark:bg-green-900 text-green-800 dark:text-green-400 border-green-800 dark:border-green-400 hover:border-green-500 focus-visible:ring-green-500 disabled:opacity-50 disabled:bg-green-200 dark:disabled:bg-green-950 disabled:text-green-600 dark:disabled:text-green-600 disabled:border-green-600 dark:disabled:border-green-600 disabled:hover:border-green-800',
		secondary:
			'text-neutral-900 dark:text-neutral-300 border-neutral-900 dark:border-neutral-300 hover:border-neutral-900/85 focus-visible:ring-neutral-400 disabled:opacity-50 disabled:text-neutral-500 dark:disabled:text-neutral-600 disabled:border-neutral-500 dark:disabled:border-neutral-600 disabled:hover:border-neutral-900',
		ghost:
			'bg-transparent text-green-800 dark:text-green-400 border-transparent hover:bg-green-200/50 dark:hover:bg-green-900/30 focus-visible:ring-green-500 disabled:opacity-50 disabled:text-green-600 dark:disabled:text-green-600 disabled:hover:bg-transparent',
	}
</script>

<button
	{type}
	class={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
	onclick={onClick}
	{disabled}
	aria-label={ariaLabel}
>
	{@render children?.()}
</button>
