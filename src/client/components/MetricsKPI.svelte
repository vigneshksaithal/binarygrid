<script lang="ts">
    import Sparkline from "./Sparkline.svelte";

    const {
        label,
        value,
        sparklineValues,
    }: {
        label: string;
        value: string | number | null | undefined;
        sparklineValues?: number[];
    } = $props();

    const displayValue = $derived(
        value === null || value === undefined ? "—" : value,
    );
</script>

<div
    class="flex flex-col gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 p-4 min-w-32"
>
    <span
        class="text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase"
    >
        {label}
    </span>
    <span
        class="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums"
    >
        {displayValue}
    </span>
    {#if sparklineValues && sparklineValues.length > 0}
        <div class="mt-1 text-zinc-400 dark:text-zinc-500">
            <Sparkline values={sparklineValues} width={80} height={24} />
        </div>
    {/if}
</div>
