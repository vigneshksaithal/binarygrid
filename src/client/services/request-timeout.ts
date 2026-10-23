/**
 * Aborts a request that hangs, so a stalled connection fails visibly (and can
 * be retried) instead of loading or saving forever.
 */
export const timeoutSignal = (ms: number): AbortSignal => {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}
