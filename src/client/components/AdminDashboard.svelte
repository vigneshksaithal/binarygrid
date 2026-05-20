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

    // Determine if loaded data is all zeros (no real data yet)
    const hasData = $derived(
        $metricsStore.metrics !== null &&
        $metricsStore.metrics.length > 0 &&
        $metricsStore.metrics.some(
            (m) => m.dau > 0 || m.impressions > 0 || m.shares > 0 || m.referredOpens > 0,
        ),
    );

    const handleRetry = () => {
        fetchMetrics(14);
    };

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
        {:else if $metricsStore.error}
            <!-- Error state with retry -->
            <div
                class="flex flex-col gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4"
                role="alert"
                aria-live="assertive"
            >
                <p class="text-sm text-red-700 dark:text-red-300">
                    {$metricsStore.error}
                </p>
                <button
                    type="button"
                    class="self-start rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                    onclick={handleRetry}
                >
                    Retry
                </button>
            </div>
        {:else if !hasData}
            <!-- Empty state -->
            <div
                class="flex flex-col items-center gap-3 py-8 text-center"
                aria-live="polite"
            >
                <p class="text-sm text-zinc-500 dark:text-zinc-400">
                    No analytics data yet. Metrics will appear once users start interacting with the app.
                </p>
                <button
                    type="button"
                    class="rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors"
                    onclick={handleRetry}
                >
                    Refresh
                </button>
            </div>
        {:else}
            <!-- KPI cards — only shown when there is actual data -->
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
        {/if}
    </section>
{/if}
