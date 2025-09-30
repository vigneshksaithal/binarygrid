<script lang="ts">
import { closeHowTo, showHowTo } from '../stores/ui'
import Button from './Button.svelte'
</script>

{#if $showHowTo}
	<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
		<div
			class="max-w-2xl w-[90%] border border-green-700 bg-black text-green-300 p-6 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
		>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-2xl text-green-400">How to Play</h2>
			</div>
			<div class="space-y-3 text-green-200">
				<p>Fill every cell with 0 or 1.</p>
				<ul class="list-disc pl-6 space-y-2">
					<li>Tap a cell to cycle: ▢ → 0 → 1 → ▢</li>
					<li>No triples: 000 or 111 in any row/column ✖</li>
					<li>Balance each line: 3 zeros and 3 ones ⚖</li>
					<li>Gray cells are fixed 🔒 (you can't change them)</li>
					<li>Win to reveal Today’s ASCII Character 🎁</li>
				</ul>
				<p class="text-sm">
					When all rules are met, the game will auto‑submit ⏱
				</p>
			</div>
			<div class="mt-6 text-right">
				<Button onClick={closeHowTo}>Got it</Button>
			</div>
		</div>
	</div>
{/if}
