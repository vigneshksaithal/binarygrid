<script lang="ts">
	import confetti from 'canvas-confetti'
	import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
	import {
		closeSuccessModal,
		openLeaderboardModal,
		openPlayOverlay,
		showSuccessModal,
	} from '../stores/ui'
	import Button from './Button.svelte'
	import Modal from './Modal.svelte'

	let isJoining = $state(false)

	const viewLeaderboard = () => {
		closeSuccessModal()
		openLeaderboardModal()
	}

	const playAnotherDifficulty = () => {
		closeSuccessModal()
		openPlayOverlay()
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
	<h2 id="success-modal-title">Congratulations!</h2>
	<div id="success-modal-body" class="grid gap-2">
		<p class="mb-4">
			You solved it in {formatElapsedTime($elapsedSeconds)}.
		</p>
		<div class="flex flex-col gap-3 justify-center mb-6">
			<Button>Comment Result</Button>
			<Button variant="default" onClick={playAnotherDifficulty}>
				Play next Difficulty
			</Button>
			<Button variant="secondary" onClick={viewLeaderboard}>Leaderboard</Button>
		</div>
		<p class="text-sm mb-6">Join r/binarygrid for daily challenges.</p>
	</div>
	<footer class="flex justify-end gap-4">
		<Button onClick={joinSubreddit} disabled={isJoining}>
			{#if isJoining}
				Joining…
			{:else}
				Join
			{/if}
		</Button>
	</footer>
</Modal>
