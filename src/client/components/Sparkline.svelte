<script lang="ts">
    type Props = {
        values: number[];
        width?: number;
        height?: number;
        color?: string;
    };

    const {
        values,
        width = 100,
        height = 30,
        color = "currentColor",
    }: Props = $props();

    // Padding to prevent polyline from being clipped at the edges
    const PADDING = 1;

    const points = $derived.by(() => {
        if (values.length === 0) return "";
        if (values.length === 1) {
            // Single point: draw a horizontal line at mid-height
            const y = height / 2;
            return `0,${y} ${width},${y}`;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;

        // When all values are the same, draw a flat line at mid-height
        const normalizeY = (v: number): number =>
            range === 0
                ? height / 2
                : PADDING + ((max - v) / range) * (height - 2 * PADDING);

        const stepX = (width - 2 * PADDING) / (values.length - 1);

        return values
            .map((v, i) => `${PADDING + i * stepX},${normalizeY(v)}`)
            .join(" ");
    });
</script>

<svg
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    aria-hidden="true"
    role="img"
>
    {#if points}
        <polyline
            {points}
            fill="none"
            stroke={color}
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
    {/if}
</svg>
