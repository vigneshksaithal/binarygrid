<script lang="ts">
	import { nextHint } from '../../shared/validator'
	import { game, loadPuzzle } from '../stores/game'
	import { theme, toggleTheme } from '../stores/theme'

	let difficulty = $state<'easy' | 'medium' | 'hard'>('medium')

	const start = () => loadPuzzle(difficulty)
	const hint = () => {
		const s = $game
		if (!s || !s.puzzleId) return
		const h = nextHint(s.grid, s.fixed)
		if (!h) return
		const { r, c, v } = h
		const next = s.grid.map((row) => row.slice())
		if (!next[r]) return
		next[r][c] = v
		game.set({ ...s, grid: next })
	}
</script>

<div class="flex items-center gap-1 sm:gap-2 text-green-400 flex-wrap">
	<select
		bind:value={difficulty}
		class="bg-black text-green-400 border border-green-700 px-1 py-1 sm:px-2 text-xs sm:text-sm"
	>
		<option value="easy">easy</option>
		<option value="medium">medium</option>
		<option value="hard">hard</option>
	</select>
	<button
		class="px-2 py-1 sm:px-3 border border-green-700 hover:bg-green-500/10 text-xs sm:text-sm"
		onclick={start}>New</button
	>
	<button
		class="px-2 py-1 sm:px-3 border border-green-700 hover:bg-green-500/10 text-xs sm:text-sm"
		onclick={hint}>Hint</button
	>
	<button
		class="px-2 py-1 sm:px-3 border border-green-700 hover:bg-green-500/10 text-xs sm:text-sm"
		onclick={toggleTheme}>{$theme === 'dark' ? 'Light' : 'Dark'}</button
	>
</div>
