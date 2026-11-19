import type { ReactNode } from 'react'
import type { AxiosError } from 'axios'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useKeycloak } from '@react-keycloak/web'
import { Navigate, type To } from 'react-router-dom'

const REDIRECT_TIMER = 60 * 1000 // 1 minute

export const RequireAuth = ({
  children,
  redirectTo
}: {
  children?: ReactNode
  redirectTo?: string
}) => {
  const { keycloak } = useKeycloak()
  const { isError, error } = useCurrentUser()

  if (isError) {
    const state = {
      message: (error as AxiosError<{ detail?: string }> | null)?.response?.data
        ?.detail,
      severity: 'error'
    }

    // console.error('Query Error:', error)
    return <Navigate to={redirectTo as To} state={state} />
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

    return <Navigate to={redirectTo as To} />
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
