<script lang="ts">
import type { Snippet } from 'svelte'

const {
  onClick,
  disabled = false,
  type = 'button',
  children
}: {
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  children?: Snippet
} = $props()
</script>

<button
	{type}
	class="
    inline-flex items-center justify-center whitespace-nowrap px-4 py-2 rounded-2xl text-sm sm:text-base font-semibold shadow-md cursor-pointer bg-green-900 text-green-500 hover:bg-green-900/90
  "
	onclick={onClick}
	{disabled}
>
	{@render children?.()}
</button>
