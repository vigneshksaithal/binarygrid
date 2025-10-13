<script lang="ts">
  import { timer } from '../stores/timer';

  const formatElapsedTime = (elapsed: number) => {
    const minutes = Math.floor(elapsed / 60);
    const remainingSeconds = elapsed % 60;

    return `Time: ${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  };
</script>

<span
  class="text-primary-green text-sm sm:text-base font-semibold text-center"
>
  {formatElapsedTime($timer.seconds)}
</span>