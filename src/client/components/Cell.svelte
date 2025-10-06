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
	class="aspect-square w-full flex items-center justify-center font-mono font-semibold text-sm sm:text-lg md:text-xl lg:text-2xl focus:outline-none focus:ring-2 ring-primary-green disabled:opacity-70 disabled:cursor-not-allowed transition-colors hover-bg-primary-green-10 shadow-primary-green relative {fixed
		? 'bg-[rgb(var(--color-primary-green-rgb)/0.1)]'
		: ''} {hasError
		? 'border-2 border-error shadow-error'
		: 'border border-border-green'}"
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
