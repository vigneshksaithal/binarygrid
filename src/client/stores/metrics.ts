import { writable } from 'svelte/store'
import { formatMetricsAsMarkdown } from '../../shared/viral-analytics'
import type { DailyViralMetrics } from '../../shared/viral-types'

type MetricsState = {
    loading: boolean
    error: string | null
    metrics: DailyViralMetrics[] | null
}

const initialState: MetricsState = {
    loading: false,
    error: null,
    metrics: null,
}

export const metricsStore = writable<MetricsState>(initialState)

export const fetchMetrics = async (days = 14): Promise<void> => {
    metricsStore.update(state => ({ ...state, loading: true, error: null }))

    try {
        const res = await fetch(`/api/admin/metrics?days=${days}`)
        if (!res.ok) {
            const data = await res.json() as { error?: string }
            throw new Error(data.error ?? `HTTP ${res.status}`)
        }
        const data = await res.json() as { metrics: DailyViralMetrics[] }
        metricsStore.update(state => ({ ...state, loading: false, metrics: data.metrics }))
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch metrics'
        metricsStore.update(state => ({ ...state, loading: false, error: message }))
    }
}

export const copyMetricsToClipboard = async (): Promise<void> => {
    let currentMetrics: DailyViralMetrics[] | null = null
    metricsStore.subscribe(state => { currentMetrics = state.metrics })()

    const markdown = formatMetricsAsMarkdown(currentMetrics ?? [])
    await navigator.clipboard.writeText(markdown)
}
