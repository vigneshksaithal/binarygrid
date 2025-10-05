<script lang="ts">
import { get } from 'svelte/store'
import { nextHint } from '../../shared/validator'
import { game, loadPuzzle } from '../stores/game'
import Button from './Button.svelte'

let difficulty = $state<'easy' | 'medium' | 'hard'>('medium')

const start = () => loadPuzzle(difficulty)
const hint = () => {
	const s = get(game)
	if (!s?.puzzleId) {
		return
	}
	const h = nextHint(s.grid, s.fixed)
	if (!h) {
		return
	}
	const { r, c, v } = h
	const next = s.grid.map((row) => row.slice())
	if (!next[r]) {
		return
	}
	next[r][c] = v
	game.set({ ...s, grid: next })
}
</script>

<div class="flex items-center gap-1 sm:gap-2 text-green-400 flex-wrap">
	<select
		bind:value={difficulty}
		onchange={start}
		class="bg-black text-green-400 border border-green-700 px-1 py-1 sm:px-2 text-xs sm:text-sm font-medium"
	>
		<option value="easy">easy</option>
		<option value="medium">medium</option>
		<option value="hard">hard</option>
	</select>
	<Button onClick={hint}>Hint</Button>
</div>
