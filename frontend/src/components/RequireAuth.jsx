import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAuth } from '@/hooks/useAuth'
import { Navigate, useLocation } from 'react-router-dom'

const REDIRECT_TIMER = 60 * 1000 // 1 minute

export const RequireAuth = ({ children, redirectTo }) => {
  const auth = useAuth()
  const location = useLocation()
  const { isError, error: currentUserError } = useCurrentUser()

  if (auth.isLoading) {
    return null
  }

  if (currentUserError) {
    const state = {
      message:
        currentUserError?.response?.data?.detail || 'Error loading user data',
      severity: 'error'
    }
    return <Navigate to={redirectTo} state={state} />
  }

  if (!auth.isAuthenticated) {
    if (location.pathname !== redirectTo && location.pathname !== '/') {
      sessionStorage.setItem(
        'redirect',
        JSON.stringify({
          pathname: location.pathname,
          search: location.search,
          timestamp: Date.now()
        })
      )
    }
    return <Navigate to={redirectTo} state={location.state} replace />
  }

  const redirectTarget = sessionStorage.getItem('redirect')
  if (redirectTarget) {
    try {
      const parsedRedirect = JSON.parse(redirectTarget)
      const {
        timestamp,
        pathname: targetPathname,
        search: targetSearch
      } = parsedRedirect

      if (timestamp + REDIRECT_TIMER > Date.now()) {
        sessionStorage.removeItem('redirect')
        return (
          <Navigate
            to={{ pathname: targetPathname, search: targetSearch }}
            replace
          />
        )
      }
    } catch (e) {
      console.error('Error parsing redirect target from session storage', e)
      sessionStorage.removeItem('redirect')
    }
  }

  return children
}
