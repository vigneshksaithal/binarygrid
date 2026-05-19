<script lang="ts">
    import { onMount } from "svelte";
    import {
        copyMetricsToClipboard,
        fetchMetrics,
        metricsStore,
    } from "../stores/metrics";
    import CopyButton from "./CopyButton.svelte";
    import FunnelViz from "./FunnelViz.svelte";
    import MetricsKPI from "./MetricsKPI.svelte";

    const { isModerator }: { isModerator: boolean } = $props();

    // Sparkline helpers — extract a metric across all 14 days (oldest → newest)
    const dauValues = $derived(
        ($metricsStore.metrics ?? []).map((m) => m.dau).reverse(),
    );
    const kFactorValues = $derived(
        ($metricsStore.metrics ?? []).map((m) => m.kFactor).reverse(),
    );
    const shareRateValues = $derived(
        ($metricsStore.metrics ?? []).map((m) => m.shareRate * 100).reverse(),
    );
    const retentionD1Values = $derived(
        ($metricsStore.metrics ?? []).map((m) => m.retentionD1 * 100).reverse(),
    );
    const retentionD7Values = $derived(
        ($metricsStore.metrics ?? []).map((m) => m.retentionD7 * 100).reverse(),
    );

    // Latest day's values for KPI display (most-recent-first, so index 0)
    const latest = $derived($metricsStore.metrics?.[0] ?? null);

    const dauDisplay = $derived(latest ? latest.dau : null);
    const kFactorDisplay = $derived(latest ? latest.kFactor.toFixed(3) : null);
    const shareRateDisplay = $derived(
        latest ? `${(latest.shareRate * 100).toFixed(1)}%` : null,
    );
    const retentionD1Display = $derived(
        latest ? `${(latest.retentionD1 * 100).toFixed(1)}%` : null,
    );
    const retentionD7Display = $derived(
        latest ? `${(latest.retentionD7 * 100).toFixed(1)}%` : null,
    );

    // Funnel for the most recent day; fall back to all-zero funnel
    const EMPTY_FUNNEL = {
        impression: 0,
        open: 0,
        start: 0,
        complete: 0,
        share: 0,
        referOpen: 0,
    };
    const funnelData = $derived(latest?.funnel ?? EMPTY_FUNNEL);

    onMount(() => {
        fetchMetrics(14);
    });
</script>

{#if isModerator}
    <section
        class="flex flex-col gap-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900 p-6"
        aria-label="Admin metrics dashboard"
    >
        <h2
            class="text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight"
        >
            Viral Metrics — Last 14 Days
        </h2>

        <!-- Loading state -->
        {#if $metricsStore.loading}
            <div
                class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"
                aria-live="polite"
                aria-busy="true"
            >
                <span
                    class="inline-block size-4 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin"
                    aria-hidden="true"
                ></span>
                Loading metrics…
            </div>
        {/if}

        <!-- Error message -->
        {#if $metricsStore.error}
            <p
                class="text-sm text-red-600 dark:text-red-400"
                role="alert"
                aria-live="assertive"
            >
                {$metricsStore.error}
            </p>
        {/if}

        <!-- KPI cards — always rendered; show empty state on fetch failure -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricsKPI
                label="DAU"
                value={dauDisplay}
                sparklineValues={dauValues}
            />
            <MetricsKPI
                label="K-Factor"
                value={kFactorDisplay}
                sparklineValues={kFactorValues}
            />
            <MetricsKPI
                label="Share Rate"
                value={shareRateDisplay}
                sparklineValues={shareRateValues}
            />
            <MetricsKPI
                label="D1 Retention"
                value={retentionD1Display}
                sparklineValues={retentionD1Values}
            />
            <MetricsKPI
                label="D7 Retention"
                value={retentionD7Display}
                sparklineValues={retentionD7Values}
            />
        </div>

        <!-- Conversion funnel -->
        <div class="flex flex-col gap-2">
            <h3
                class="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
            >
                Conversion Funnel
            </h3>
            <FunnelViz funnel={funnelData} />
        </div>

        <!-- Clipboard export -->
        <div class="flex justify-end">
            <CopyButton onCopy={copyMetricsToClipboard} />
        </div>
    </section>
{/if}
