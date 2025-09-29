import { get, writable } from 'svelte/store'
import { SIZE } from '../../shared/rules'
import type { Cell, Difficulty, Grid, PuzzleWithGrid } from '../../shared/types/puzzle'
import { isComplete, validateGrid } from '../../shared/validator'

type Status = 'idle' | 'loading' | 'in_progress' | 'solved' | 'invalid' | 'error'

type GameState = {
    puzzleId: string | null
    difficulty: Difficulty
    grid: Grid
    fixed: { r: number; c: number; v: 0 | 1 }[]
    status: Status
    errors: string[]
}

const emptyGrid = (): Grid => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null as Cell))

const initial: GameState = {
    puzzleId: null,
    difficulty: 'medium',
    grid: emptyGrid(),
    fixed: [],
    status: 'idle',
    errors: []
}

export const game = writable<GameState>(initial)

const storageKey = (id: string) => `binarygrid:${id}`

export const loadPuzzle = async (difficulty: Difficulty, dateISO?: string) => {
    game.update(s => ({ ...s, status: 'loading', errors: [] }))
    const date = dateISO ?? new Date().toISOString().slice(0, 10)
    const res = await fetch(`/api/puzzle?date=${date}&difficulty=${difficulty}`)
    if (!res.ok) {
        game.update(s => ({ ...s, status: 'error', errors: ['failed to load puzzle'] }))
        return
    }
    const data = (await res.json()) as { puzzle: PuzzleWithGrid }
    const id = data.puzzle.id
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey(id)) : null
    const grid: Grid = saved ? JSON.parse(saved) : data.puzzle.initial
    game.set({
        puzzleId: id,
        difficulty,
        grid,
        fixed: data.puzzle.fixed,
        status: 'in_progress',
        errors: []
    })
}

export const resetPuzzle = () => {
    game.update(s => {
        if (!s.puzzleId) return s
        const grid = emptyGrid()
        if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey(s.puzzleId))
        return { ...s, grid, status: 'in_progress', errors: [] }
    })
}

export const cycleCell = (r: number, c: number) => {
    game.update(s => {
        if (s.status === 'solved') return s
        const isFixed = s.fixed.some(f => f.r === r && f.c === c)
        if (isFixed) return s
        const next = s.grid.map(row => row.slice())
        const row = next[r]
        if (!row) return s
        const cur = row[c]
        row[c] = cur === null ? 0 : cur === 0 ? 1 : null
        const result = validateGrid(next, s.fixed)
        const status: Status = result.ok ? (isComplete(next) ? 'solved' : 'in_progress') : 'invalid'
        if (s.puzzleId && typeof localStorage !== 'undefined') localStorage.setItem(storageKey(s.puzzleId), JSON.stringify(next))
        return { ...s, grid: next, status, errors: result.ok ? [] : result.errors }
    })
}

export const autosubmitIfSolved = async () => {
    const snapshot = get(game)
    if (!snapshot || snapshot.status !== 'solved' || !snapshot.puzzleId) return
    await fetch('/api/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: snapshot.puzzleId, grid: snapshot.grid })
    })
}


