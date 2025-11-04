<script lang="ts">
  import { SIZE } from '../../shared/rules'
  import { autosubmitIfSolved, cycleCell, game } from '../stores/game'
  import Cell from './Cell.svelte'

  $effect(() => {
    if ($game.status === 'solved') {
      autosubmitIfSolved()
    }
  })
</script>

<div
  class="w-full grid grid-cols-6 gap-2 sm:gap-4 p-4 sm:p-6 bg-zinc-800 text-primary-green rounded-3xl"
>
  {#if $game.status === 'solved'}
  <div
    class="col-span-6 text-sm text-primary-green mb-2 font-semibold text-center"
  >
    Solved
  </div>
  {/if}
  {#each Array.from({ length: SIZE }) as _, r}
  {#each Array.from({ length: SIZE }) as __, c}
  {#if $game.grid[r]}
  <Cell
    value={$game.grid[r][c] ?? null}
    fixed={$game.fixed.some((f) => f.r === r && f.c === c)}
    hasError={$game.errorLocations?.rows.includes(r) ||
						$game.errorLocations?.columns.includes(c) ||
						false}
    onClick={() => cycleCell(r, c)}
  />
  {/if}
  {/each}
  {/each}
  {#if $game.status === 'invalid'}
  <div
    class="col-span-6 text-sm text-error mt-2 space-y-1 bg-error/10 p-3 rounded-lg"
  >
    <div class="flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011-1h.008a1 1 0 110 2H10a1 1 0 01-1-1z"
          clip-rule="evenodd"
        />
      </svg>
      <div class="space-y-1">
        {#each $game.errors as error}
        <div>{error}</div>
        {/each}
      </div>
    </div>
  </div>
  {/if}
  {#if $game.status === 'loading'}
  <div class="col-span-6 text-sm text-primary-green mt-2 font-medium">
    Loading…
  </div>
  {/if}
</div>
