<script lang="ts">
    type Props = { count: number };
    let { count }: Props = $props();
</script>

<p class="text-sm text-zinc-500 dark:text-zinc-400 text-center">
    <span class="font-semibold text-zinc-700 dark:text-zinc-300">{count}</span>
    {count === 1 ? "player" : "players"} solved today
</p>
