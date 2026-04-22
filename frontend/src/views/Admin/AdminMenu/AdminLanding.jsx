import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { roles } from '@/constants/roles'
import { ROUTES } from '@/routes/routes'
import Loading from '@/components/Loading'

// Redirects /admin to the first tab the user can access.
// Admins go to users list, System Admins go to logon screen background.
export const AdminLanding = () => {
  const { data: currentUser, isLoading, hasRoles } = useCurrentUser()

  if (isLoading || !currentUser) {
    return <Loading />
  }

  if (hasRoles(roles.administrator)) {
    return <Navigate to={ROUTES.ADMIN.USERS.LIST} replace />
  }

  if (hasRoles(roles.system_admin)) {
    return <Navigate to={ROUTES.ADMIN.LOGIN_SCREEN_BACKGROUND} replace />
  }

  return <Navigate to={ROUTES.DASHBOARD} replace />
}

export default AdminLanding
