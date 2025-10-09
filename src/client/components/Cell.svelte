<script lang="ts">
const {
  value = null,
  fixed = false,
  hasError = false,
  onClick
}: {
  value?: 0 | 1 | null
  fixed?: boolean
  hasError?: boolean
  onClick?: () => void
} = $props()

const handleClick = () => {
  if (onClick) {
    onClick()
  }
}

const label = fixed ? 'Fixed cell' : 'Editable cell'
</script>

<button
	type="button"
	class="aspect-square w-full flex items-center justify-center font-mono font-semibold text-base sm:text-lg md:text-xl lg:text-2xl focus:outline-none focus:ring-2 ring-primary-green bg-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed rounded-lg transition-colors hover-bg-primary-green-10 relative {fixed
		? 'bg-[rgb(var(--color-primary-green-rgb)/0.1)]'
		: ''} {hasError ? 'border-2 border-error' : 'border border-zinc-700'}"
	onclick={handleClick}
	aria-label={label}
	disabled={fixed}
>
	{#if fixed}
		<span
			class="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-primary-green-rgb)/0.9)]"
		></span>
	{/if}
	{#if value === 0}
		0
	{:else if value === 1}
		1
	{/if}
</button>
