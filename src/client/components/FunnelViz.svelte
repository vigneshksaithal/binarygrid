<script lang="ts">
    import type { FunnelMetrics } from "../../shared/viral-types";

    const { funnel }: { funnel: FunnelMetrics } = $props();

    const STAGES = [
        { key: "impression", label: "Impression" },
        { key: "open", label: "Open" },
        { key: "start", label: "Start" },
        { key: "complete", label: "Complete" },
        { key: "share", label: "Share" },
        { key: "referOpen", label: "Refer Open" },
    ] as const;

    const BAR_HEIGHT = 16;
    const BAR_GAP = 28;
    const LABEL_WIDTH = 80;
    const COUNT_WIDTH = 56;
    const BAR_AREA_WIDTH = 200;
    const SVG_WIDTH = LABEL_WIDTH + BAR_AREA_WIDTH + COUNT_WIDTH;
    const SVG_HEIGHT = STAGES.length * BAR_GAP;

    const maxValue = $derived(Math.max(1, ...STAGES.map((s) => funnel[s.key])));

    const rows = $derived(
        STAGES.map((stage, i) => {
            const value = funnel[stage.key];
            const barWidth = (value / maxValue) * BAR_AREA_WIDTH;
            const y = i * BAR_GAP;
            return { label: stage.label, value, barWidth, y };
        }),
    );
</script>

<div class="w-full overflow-x-auto">
    <svg
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        viewBox="0 0 {SVG_WIDTH} {SVG_HEIGHT}"
        role="img"
        aria-label="Conversion funnel chart"
    >
        {#each rows as row}
            <!-- Stage label -->
            <text
                x={LABEL_WIDTH - 8}
                y={row.y + BAR_HEIGHT / 2 + 1}
                text-anchor="end"
                dominant-baseline="middle"
                class="fill-zinc-500 dark:fill-zinc-400 text-[11px] font-medium"
                font-size="11"
            >
                {row.label}
            </text>

            <!-- Bar background track -->
            <rect
                x={LABEL_WIDTH}
                y={row.y}
                width={BAR_AREA_WIDTH}
                height={BAR_HEIGHT}
                rx="4"
                class="fill-zinc-200 dark:fill-zinc-700"
            />

            <!-- Bar fill -->
            {#if row.barWidth > 0}
                <rect
                    x={LABEL_WIDTH}
                    y={row.y}
                    width={row.barWidth}
                    height={BAR_HEIGHT}
                    rx="4"
                    class="fill-indigo-500 dark:fill-indigo-400"
                />
            {/if}

            <!-- Count label -->
            <text
                x={LABEL_WIDTH + BAR_AREA_WIDTH + 8}
                y={row.y + BAR_HEIGHT / 2 + 1}
                dominant-baseline="middle"
                class="fill-zinc-700 dark:fill-zinc-300 tabular-nums text-[11px] font-semibold"
                font-size="11"
            >
                {row.value.toLocaleString()}
            </text>
        {/each}
    </svg>
</div>
