<script lang="ts">
	import type { Snippet } from 'svelte'

	type Variant = 'default' | 'secondary' | 'ghost'
	type Size = 'sm' | 'default' | 'icon' | 'icon-sm'

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
		'inline-flex items-center justify-center whitespace-nowrap font-semibold tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer border-2 disabled:cursor-not-allowed rounded-full hover:scale-110 transition-transform duration-200'

	const sizeClasses = {
		sm: 'h-8 px-3 text-sm gap-1.5',
		default: 'px-4 py-3 text-sm',
		icon: 'size-9 p-0',
		'icon-sm': 'size-8 p-0',
	}

	const variantClasses = {
		default:
			'bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border-zinc-600 dark:border-zinc-400 hover:border-zinc-700 dark:hover:border-zinc-300 focus-visible:ring-zinc-500 disabled:opacity-50 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-600 disabled:border-zinc-500 dark:disabled:border-zinc-600 disabled:hover:border-zinc-600',
		secondary:
			'text-neutral-900 dark:text-neutral-300 border-neutral-900 dark:border-neutral-300 focus-visible:ring-neutral-400 disabled:opacity-90 disabled:text-neutral-500 dark:disabled:text-neutral-400 disabled:border-neutral-500 dark:disabled:border-neutral-400 disabled:hover:border-neutral-900',
		ghost:
			'bg-transparent text-zinc-800 dark:text-zinc-300 border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-900/30 focus-visible:ring-zinc-500 disabled:opacity-50 disabled:text-zinc-600 dark:disabled:text-zinc-600 disabled:hover:bg-transparent',
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
