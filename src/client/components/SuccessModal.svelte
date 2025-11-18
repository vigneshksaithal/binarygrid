<script lang="ts">
	import confetti from 'canvas-confetti'
	import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
	import {
		closeSuccessModal,
		openLeaderboardModal,
		showSuccessModal,
	} from '../stores/ui'
	import Button from './Button.svelte'
	import Modal from './Modal.svelte'

	let isJoining = $state(false)
	let isCommenting = $state(false)
	let commentError = $state<string | null>(null)
	let commentSuccess = $state(false)

	const viewLeaderboard = () => {
		closeSuccessModal()
		openLeaderboardModal()
	}

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
				// biome-ignore lint/suspicious/noConsole: we want to log the error
				console.error('Failed to join subreddit')
			}
		} catch (error) {
			// biome-ignore lint/suspicious/noConsole: we want to log the error
			console.error('Failed to join subreddit', error)
		} finally {
			isJoining = false
		}
	}

	const commentScore = async () => {
		if (isCommenting) {
			return
		}
		isCommenting = true
		commentError = null
		commentSuccess = false

		try {
			const res = await fetch('/api/comment-score', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					solveTimeSeconds: $elapsedSeconds,
				}),
			})

			if (res.ok) {
				commentSuccess = true
			} else {
				const data = await res.json().catch(() => ({}))
				commentError = data.error || 'Failed to post comment'
			}
		} catch (error) {
			commentError = 'Failed to post comment. Please try again.'
			// biome-ignore lint/suspicious/noConsole: we want to log the error
			console.error('Failed to post comment', error)
		} finally {
			isCommenting = false
		}
	}

	const showConfetti = () => {
		const CONFETTI_PARTICLE_COUNT = 100
		const CONFETTI_SPREAD = 70
		const CONFETTI_ORIGIN_Y = 0.6 // Vertical origin to start confetti lower on the screen

		confetti({
			particleCount: CONFETTI_PARTICLE_COUNT,
			spread: CONFETTI_SPREAD,
			origin: { y: CONFETTI_ORIGIN_Y },
		})
	}

	$effect(() => {
		if ($showSuccessModal) {
			showConfetti()
		}
	})
</script>

<Modal
	open={$showSuccessModal}
	onClose={closeSuccessModal}
	labelledby="success-modal-title"
	describedby="success-modal-body"
>
	<h2 id="success-modal-title" class="text-green-500 dark:text-green-400">
		Congratulations!
	</h2>
	<div id="success-modal-body" class="grid gap-2 text-zinc-100">
		<h3 class="text-lg font-semibold">
			You solved the puzzle in
			<span class="text-green-500 dark:text-green-400"
				>{formatElapsedTime($elapsedSeconds)}</span
			>.
		</h3>
		<div class="flex justify-center my-4">
			<Button onClick={commentScore} disabled={isCommenting}>
				{#if isCommenting}
					Posting…
				{:else}
					Comment Result
				{/if}
			</Button>
		</div>
		{#if commentError}
			<p class="text-sm text-red-500 dark:text-red-400 mb-2">
				{commentError}
			</p>
		{/if}
		{#if commentSuccess}
			<p class="text-sm text-green-500 dark:text-green-400 mb-2">
				Comment posted successfully!
			</p>
		{/if}
		<p class="text-sm text-zinc-300 mb-6">
			Join r/binarygrid for daily challenges.
		</p>
	</div>
	<footer class="flex justify-end gap-4">
		<button
			type="button"
			class="text-sm font-medium text-zinc-300 hover:text-green-500 dark:hover:text-green-400 transition-colors"
			onclick={closeSuccessModal}
		>
			Back
		</button>
		<Button variant="secondary" onClick={viewLeaderboard}>Leaderboard</Button>
		<Button onClick={joinSubreddit} disabled={isJoining}>
			{#if isJoining}
				Joining…
			{:else}
				Join
			{/if}
		</Button>
	</footer>
</Modal>
