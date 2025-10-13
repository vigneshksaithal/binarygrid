<script lang="ts">
  import { onMount } from 'svelte';
  import { successModal, closeSuccessModal } from '../stores/ui';
  import Button from './Button.svelte';
  import confetti from 'canvas-confetti';

  const joinSubreddit = async () => {
    const res = await fetch('/api/join-subreddit');
    if (res.ok) {
      closeSuccessModal();
    } else {
      // biome-ignore lint/suspicious/noConsole: Testing
      console.error('Failed to join subreddit');
    }
  };

  const formatElapsedTime = (elapsed: number | null) => {
    if (elapsed === null) return '';
    const minutes = Math.floor(elapsed / 60);
    const remainingSeconds = elapsed % 60;
    return `Time: ${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  };

  onMount(() => {
    const fireConfetti = () => {
      const canvas = document.createElement('canvas');
      document.body.appendChild(canvas);
      const myConfetti = confetti.create(canvas, {
        resize: true,
        useWorker: true,
      });
      myConfetti({
        particleCount: 100,
        spread: 160,
        origin: { y: 0.6 },
      });
      document.body.removeChild(canvas);
    };

    if ($successModal.isOpen) {
      fireConfetti();
    }
  });
</script>

{#if $successModal.isOpen}
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
        <p>{formatElapsedTime($successModal.finalTime)}</p>
        <p>Please join the subreddit to play the daily challenges.</p>
      </div>
      <footer>
        <Button onClick={joinSubreddit}>Join Subreddit</Button>
      </footer>
    </div>
  </section>
{/if}