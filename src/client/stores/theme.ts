import { writable } from 'svelte/store'

type Theme = 'dark' | 'light'

const detect = (): Theme => {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
  ) {
    return 'light'
  }
  return 'dark'
}

const persistTheme = async (value: Theme) => {
  try {
    await fetch('/api/theme', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: value })
    })
  } catch {
    // Persistence is best-effort
  }
}

const loadRemoteTheme = async (): Promise<Theme | null> => {
  try {
    const res = await fetch('/api/theme')
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as { theme: Theme | null }
    if (data.theme === 'dark' || data.theme === 'light') {
      return data.theme
    }
  } catch {
    return null
  }
  return null
}

export const theme = writable<Theme>(detect())

export const initializeTheme = async () => {
  if (typeof window === 'undefined') {
    return
  }
  const remote = await loadRemoteTheme()
  if (remote) {
    theme.set(remote)
  }
}

export const toggleTheme = () => {
  theme.update((current) => {
    const next = current === 'dark' ? 'light' : 'dark'
    void persistTheme(next)
    return next
  })
}

if (typeof window !== 'undefined') {
  void initializeTheme()
}
