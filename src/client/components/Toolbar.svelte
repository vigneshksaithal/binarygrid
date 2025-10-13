<script lang="ts">
  import { get } from 'svelte/store';
  import { game, loadPuzzle } from '../stores/game';
  import { timer } from '../stores/timer';
  import { openHowTo, openSuccessModal } from '../stores/ui';
  import Button from './Button.svelte';
  import SuccessModal from './SuccessModal.svelte';
  import HowToPlayModal from './HowToPlayModal.svelte';

  let showNewGameOptions = false;

  const toggleNewGameOptions = () => {
    showNewGameOptions = !showNewGameOptions;
  };

  game.subscribe(async (g) => {
    if (g.status === 'solved') {
      const finalTime = get(timer).seconds;
      openSuccessModal(finalTime);
    }
  });
</script>

<div class="w-full flex justify-between items-center">
  <div class="relative">
    <Button onClick={toggleNewGameOptions}>New Game</Button>
    {#if showNewGameOptions}
      <div class="absolute top-full left-0 mt-2 bg-zinc-800 rounded-md shadow-lg">
        <Button onClick={() => loadPuzzle('easy')}>Easy</Button>
        <Button onClick={() => loadPuzzle('medium')}>Medium</Button>
        <Button onClick={() => loadPuzzle('hard')}>Hard</Button>
      </div>
    {/if}
  </div>
  <Button onClick={openHowTo}>How to Play</Button>
</div>

<SuccessModal />
<HowToPlayModal />