import Loading from '@/components/Loading'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useKeycloak } from '@react-keycloak/web'
import { Navigate } from 'react-router-dom'

export const RequireAuth = ({ children, redirectTo }) => {
  const { keycloak, initialized } = useKeycloak()
  const { isLoading, isError, error } = useCurrentUser()

  if (isError) {
    const state = {
      message: error?.response?.data?.detail,
      severity: 'error'
    }

    // console.error('Query Error:', error)
    return <Navigate to={redirectTo} state={state} />
  }

  if (!keycloak.authenticated) {
    // console.error('User not authenticated')
    return <Navigate to={redirectTo} />
  }

  return children
}
