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
  'border border-border-green font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed'
const color = 'text-primary-green'
const variantClasses =
  variant === 'primary'
    ? 'hover-bg-primary-green-20'
    : 'hover-bg-primary-green-10'

const bgClass =
  variant === 'primary' ? 'bg-[rgb(var(--color-primary-green-rgb)/0.1)]' : ''

const computedClass = `${sizeClasses} ${base} ${variantClasses} ${color} ${bgClass} ${classes}`
</script>

<button {type} class={computedClass} onclick={handleClick} {disabled}>
	{@render children?.()}
</button>
