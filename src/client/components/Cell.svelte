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

  const borderClass = $derived(
    (hasError && 'border-2 border-error') || 'border border-zinc-700'
  )
</script>

<button
  type="button"
  class="aspect-square w-full flex items-center justify-center font-mono font-semibold text-base md:text-lg focus:outline-none focus:ring-2 ring-primary-green border-b disabled:opacity-70 disabled:cursor-not-allowed rounded-lg transition-colors hover-bg-primary-green-10 relative {fixed
		? 'bg-[rgb(var(--color-primary-green-rgb)/0.1)]'
		: ''} {borderClass}"
  onclick={handleClick}
  aria-label={label}
  disabled={fixed}
>
  {#if value === 0}0{:else if value === 1}1{/if}
</button>
