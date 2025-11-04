<script lang="ts">
  import confetti from 'canvas-confetti'
  import { elapsedSeconds, formatElapsedTime } from '../stores/timer'
  import { closeSuccessModal, showSuccessModal } from '../stores/ui'
  import Button from './Button.svelte'
  import Modal from './Modal.svelte'

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
        console.error('Failed to join subreddit')
      }
    } catch (error) {
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
      origin: { y: CONFETTI_ORIGIN_Y }
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
  <h2 id="success-modal-title" class="text-primary-green">Congratulations!</h2>
  <div id="success-modal-body" class="grid gap-2 text-zinc-100">
    <h3 class="text-lg font-semibold">
      You solved the puzzle in
      <span class="text-primary-green"
        >{formatElapsedTime($elapsedSeconds)}</span
      >.
    </h3>
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
    <button onClick={joinSubreddit} disabled={isJoining}>
      {#if isJoining}
      Joining…
      {:else}
      Join r/binarygrid
      {/if}
    </button>
  </footer>
</Modal>
