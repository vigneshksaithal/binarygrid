<script lang="ts">
  import type { LeaderboardEntry } from '../../shared/types/leaderboard'

  let { entry }: { entry: LeaderboardEntry } = $props()
</script>

<div class="flex items-center justify-between p-2">
  <div class="flex items-center gap-2">
    <span class="w-6 text-center">{entry.rank}</span>
    <span>{entry.username}</span>
  </div>
  <span>{entry.score}</span>
</div>
