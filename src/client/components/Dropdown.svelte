<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import { cubicOut } from 'svelte/easing'
	import { fly } from 'svelte/transition'

	type Option = {
		value: string
		label: string
	}

	type Size = 'sm' | 'default'

	const {
		value,
		options,
		onChange,
		ariaLabel = 'Select option',
		size = 'default',
	}: {
		value: string
		options: Option[]
		onChange: (value: string) => void
		ariaLabel?: string
		size?: Size
	} = $props()

	let isOpen = $state(false)
	let dropdownRef: HTMLDivElement | undefined = $state()

	// Find the currently selected option for display
	const selectedOption = $derived(
		options.find((opt) => opt.value === value) ?? options[0],
	)

	const toggleDropdown = () => {
		isOpen = !isOpen
	}

	const handleSelect = (selectedValue: string) => {
		onChange(selectedValue)
		isOpen = false
	}

	// Click-outside-to-close
	$effect(() => {
		if (isOpen) {
			const handleClickOutside = (event: MouseEvent) => {
				if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
					isOpen = false
				}
			}

			// Delay to avoid immediate trigger when opening
			setTimeout(() => {
				document.addEventListener('click', handleClickOutside)
			}, 0)

			return () => {
				document.removeEventListener('click', handleClickOutside)
			}
		}
	})

	const baseClasses =
		'inline-flex items-center justify-center whitespace-nowrap font-semibold tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer border-2 disabled:cursor-not-allowed rounded-full transition-all duration-200'

	const sizeClasses = {
		sm: 'h-8 px-3 text-sm gap-1.5',
		default: 'px-4 py-3 text-sm gap-2',
	}

	const triggerClasses =
		'bg-transparent text-zinc-800 dark:text-zinc-300 border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-900/30 focus-visible:ring-zinc-500'
</script>

<div class="relative inline-block" bind:this={dropdownRef}>
	<!-- Trigger Button -->
	<button
		type="button"
		class={`${baseClasses} ${triggerClasses} ${sizeClasses[size]} uppercase`}
		onclick={toggleDropdown}
		aria-haspopup="listbox"
		aria-expanded={isOpen}
		aria-label={ariaLabel}
	>
		<span>{selectedOption?.label}</span>
		<ChevronDownIcon
			class={`size-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
		/>
	</button>

	<!-- Dropdown Menu -->
	{#if isOpen}
		<div
			class="absolute top-full mt-1 min-w-full bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-600 rounded-xl shadow-lg z-50"
			role="listbox"
			transition:fly={{ y: -8, duration: 200, easing: cubicOut }}
		>
			{#each options as option, index (option.value)}
				<button
					type="button"
					class={`w-full px-4 py-2 text-left text-sm font-semibold tracking-wider uppercase text-zinc-800 dark:text-zinc-300 transition-colors duration-150 cursor-pointer focus-visible:outline-none ${
						index === 0 ? 'rounded-t-xl' : ''
					} ${index === options.length - 1 ? 'rounded-b-xl' : ''} ${
						value === option.value
							? 'bg-zinc-300/50 dark:bg-zinc-700/50 text-zinc-900 dark:text-zinc-100 font-bold'
							: 'hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70'
					}`}
					onclick={() => handleSelect(option.value)}
					role="option"
					aria-selected={value === option.value}
					tabindex="0"
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
