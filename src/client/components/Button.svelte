<script lang="ts">
import type { Snippet } from 'svelte'

const {
  onClick,
  disabled = false,
  variant = 'default',
  type = 'button',
  classes = '',
  children
}: {
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'primary'
  type?: 'button' | 'submit' | 'reset'
  classes?: string
  children?: Snippet
} = $props()

const handleClick = () => {
  if (onClick) {
    onClick()
  }
}

const sizeClasses = 'px-3 py-1.5 sm:px-3 text-sm sm:text-base'

const base =
  'border border-green-700 font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed'
const color = 'text-green-400'
const variantClasses =
  variant === 'primary'
    ? 'bg-green-500/10 hover:bg-green-500/20'
    : 'hover:bg-green-500/10'

const computedClass = `${sizeClasses} ${base} ${variantClasses} ${color} ${classes}`
</script>

<button {type} class={computedClass} onclick={handleClick} {disabled}>
	{@render children?.()}
</button>
