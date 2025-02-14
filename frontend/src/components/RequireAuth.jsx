import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useKeycloak } from '@react-keycloak/web'
import { Navigate } from 'react-router-dom'

const REDIRECT_TIMER = 60 * 1000 // 1 minute

export const RequireAuth = ({ children, redirectTo }) => {
  const { keycloak } = useKeycloak()
  const { isError, error } = useCurrentUser()

  if (isError) {
    const state = {
      message: error?.response?.data?.detail,
      severity: 'error'
    }

    // console.error('Query Error:', error)
    return <Navigate to={redirectTo} state={state} />
  }

  if (!keycloak.authenticated) {
    const pathname = window.location.pathname
    if (!pathname.endsWith('login') && pathname !== '/') {
      sessionStorage.setItem(
        'redirect',
        JSON.stringify({
          pathname,
          timestamp: Date.now()
        })
      )
    }

    return <Navigate to={redirectTo} />
  }

  const redirectTarget = sessionStorage.getItem('redirect')
  if (keycloak.authenticated && redirectTarget) {
    const parsedRedirect = JSON.parse(redirectTarget)
    const { timestamp, pathname } = parsedRedirect
    sessionStorage.removeItem('redirect')

    if (timestamp + REDIRECT_TIMER > Date.now()) {
      return <Navigate to={pathname} />
    }
  }

  return children
}
