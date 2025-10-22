<script lang="ts">
import type { Snippet } from 'svelte'

const {
  onClick,
  disabled = false,
  type = 'button',
  ariaLabel,
  children
}: {
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  ariaLabel?: string
  children?: Snippet
} = $props()
</script>

<button
	{type}
	class="
    inline-flex items-center justify-center whitespace-nowrap px-4 py-2 rounded-full text-sm sm:text-base font-semibold shadow-md cursor-pointer bg-green-900 text-green-500 hover:bg-green-900/90 transition-colors disabled:bg-green-900/50 disabled:text-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-green-900/50
  "
	onclick={onClick}
	{disabled}
	aria-label={ariaLabel}
>
	{@render children?.()}
</button>
