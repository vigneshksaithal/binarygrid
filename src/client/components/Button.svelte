<script lang="ts">
import type { Snippet } from 'svelte'

const {
  onClick,
  disabled = false,
  type = 'button',
  cooldown = false,
  children
}: {
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  cooldown?: boolean
  children?: Snippet
} = $props()
</script>

<button
	{type}
	class="
    relative inline-flex items-center justify-center whitespace-nowrap px-4 py-2 rounded-2xl text-sm sm:text-base font-semibold shadow-md cursor-pointer bg-green-900 text-green-500 hover:bg-green-900/90 overflow-hidden
  "
	onclick={onClick}
	{disabled}
>
	{#if cooldown}
		<div class="cooldown-overlay"></div>
	{/if}
	<span class="relative z-10">
		{@render children?.()}
	</span>
</button>

<style>
@keyframes slide {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}

.cooldown-overlay {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.2);
  animation: slide 2s linear forwards;
}
</style>
