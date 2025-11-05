<script lang="ts">
  import type { Snippet } from 'svelte'

  const {
    open = false,
    labelledby,
    describedby,
    role = 'dialog',
    ariaModal = true,
    children
  }: {
    open?: boolean
    labelledby?: string
    describedby?: string
    role?: 'dialog' | 'alertdialog'
    ariaModal?: boolean
    onClose?: () => void
    children?: Snippet
  } = $props()
</script>

{#if open}
<section
  class="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 backdrop-blur-xs p-4"
>
  <div
    class="w-full max-w-sm p-6 rounded-3xl shadow-md bg-zinc-800"
    {role}
    aria-modal={ariaModal}
    aria-labelledby={labelledby}
    aria-describedby={describedby}
  >
    {@render children?.()}
  </div>
</section>
{/if}
