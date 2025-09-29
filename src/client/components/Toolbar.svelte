<script lang="ts">
import { nextHint } from '../../shared/validator'
import { game, loadPuzzle, resetPuzzle } from '../stores/game'
import { theme, toggleTheme } from '../stores/theme'

let difficulty: 'easy' | 'medium' | 'hard' = 'medium'

const start = () => loadPuzzle(difficulty)
const reset = () => resetPuzzle()
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

<div class="flex items-center gap-2 text-green-400">
	<select
		bind:value={difficulty}
		class="bg-black text-green-400 border border-green-700 px-2 py-1"
	>
		<option value="easy">easy</option>
		<option value="medium">medium</option>
		<option value="hard">hard</option>
	</select>
	<button
		class="px-3 py-1 border border-green-700 hover:bg-green-500/10"
		on:click={start}>New</button
	>
	<button
		class="px-3 py-1 border border-green-700 hover:bg-green-500/10"
		on:click={reset}>Reset</button
	>
	<button
		class="px-3 py-1 border border-green-700 hover:bg-green-500/10"
		on:click={hint}>Hint</button
	>
	<button
		class="px-3 py-1 border border-green-700 hover:bg-green-500/10"
		on:click={toggleTheme}>{$theme === 'dark' ? 'Light' : 'Dark'}</button
	>
</div>
