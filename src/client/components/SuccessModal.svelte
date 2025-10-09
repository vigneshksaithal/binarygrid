<script lang="ts">
import { closeSuccessModal, showSuccessModal } from '../stores/ui'

import Button from './Button.svelte'

const joinSubreddit = async () => {
  const res = await fetch('/api/join-subreddit')
  if (res.ok) {
    closeSuccessModal()
  } else {
    // biome-ignore lint/suspicious/noConsole: Testing
    console.error('Failed to join subreddit')
  }
}
</script>

{#if $showSuccessModal}
	<section class="fixed inset-0 z-50 grid place-items-center p-4">
		<div
			class="w-full max-w-lg gap-6 p-6 rounded-xl shadow-md grid bg-zinc-800"
			role="dialog"
			aria-modal="true"
			aria-labelledby="success-modal-title"
			aria-describedby="success-modal-body"
		>
			<h2 id="success-modal-title">Congratulations!</h2>
			<div id="success-modal-body">
				<p>You've solved the puzzle!</p>
				<p>Please join the subreddit to play the daily challenges.</p>
			</div>
			<footer>
				<Button onClick={joinSubreddit}>Join Subreddit</Button>
			</footer>
		</div>
	</section>
{/if}
