import { writable } from 'svelte/store'

type Theme = 'dark' | 'light'

const detect = (): Theme => {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('binarygrid:theme') as Theme | null
		if (saved === 'dark' || saved === 'light') return saved
	}
	if (window?.matchMedia?.('(prefers-color-scheme: light)').matches) {
		return 'light'
	}
	return 'dark'
}

export const theme = writable<Theme>(detect())

export const toggleTheme = () => {
	theme.update((t) => {
		const next = t === 'dark' ? 'light' : 'dark'
		if (typeof localStorage !== 'undefined')
			localStorage.setItem('binarygrid:theme', next)
		return next
	})
}
