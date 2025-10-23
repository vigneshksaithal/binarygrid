<script lang="ts">
import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
import { closeSuccessModal, showSuccessModal } from '../stores/ui'

import Button from './Button.svelte'

let isJoining = $state(false)

const joinSubreddit = async () => {
  if (isJoining) {
    return
  }
  isJoining = true
  try {
    const res = await fetch('/api/join-subreddit')
    if (res.ok) {
      closeSuccessModal()
    } else {
      // biome-ignore lint/suspicious/noConsole: surface failure in devtools
      console.error('Failed to join subreddit')
    }
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: surface failure in devtools
    console.error('Failed to join subreddit', error)
  } finally {
    isJoining = false
  }
}
</script>

{#if $showSuccessModal}
	<section class="fixed inset-0 z-50 grid place-items-center p-4">
		<div
			class="w-full max-w-lg p-6 rounded-xl shadow-md grid bg-zinc-800"
			role="dialog"
			aria-modal="true"
			aria-labelledby="success-modal-title"
			aria-describedby="success-modal-body"
		>
			<h2
				id="success-modal-title"
				class="text-primary-green"
			>
				Congratulations!
			</h2>
			<div id="success-modal-body" class="grid gap-2 text-zinc-100">
				<p class="text-lg font-semibold">
					You solved the puzzle in
					<span class="text-primary-green"
						>{formatElapsedTime($elapsedSeconds)}</span
					>.
				</p>
				<p class="text-sm text-zinc-300 mb-6">
					Join r/binarygrid for daily challenges.
				</p>
			</div>
			<footer class="flex justify-end gap-4">
				<button
					type="button"
					class="text-sm font-medium text-zinc-300 hover:text-primary-green transition-colors"
					onclick={closeSuccessModal}
				>
					Maybe later
				</button>
				<Button onClick={joinSubreddit} disabled={isJoining}>
					{#if isJoining}
						Joining…
					{:else}
						Join r/binarygrid
					{/if}
				</Button>
			</footer>
		</div>
	</section>
{/if}
