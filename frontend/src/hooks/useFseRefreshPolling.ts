import { useCallback, useRef } from 'react'
import type { Query } from '@tanstack/react-query'

// FSE reporting rows come from a materialized view the backend refreshes a
// moment after an FSE save or a new report version. Re-fetch while the API
// reports changes not yet in it (for up to a minute), so the rows show
// without a page reload.
const REFRESH_POLL_INTERVAL_MS = 2000
const REFRESH_POLL_LIMIT_MS = 60 * 1000

/**
 * A `refetchInterval` for FSE reporting list queries: polls every 2 seconds
 * while the response says `refreshPending`, and stops when it no longer does
 * or after a minute of pending responses.
 */
export const useFseRefreshPolling = () => {
  const pendingSinceRef = useRef<number | null>(null)
  return useCallback((query: Query) => {
    const data = query.state.data as { refreshPending?: boolean } | undefined
    if (!data?.refreshPending) {
      pendingSinceRef.current = null
      return false
    }
    if (pendingSinceRef.current === null) {
      pendingSinceRef.current = Date.now()
    }
    return Date.now() - pendingSinceRef.current < REFRESH_POLL_LIMIT_MS
      ? REFRESH_POLL_INTERVAL_MS
      : false
  }, [])
}
