import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useUserStore } from '@/stores/useUserStore'
import { useAuth } from '@/hooks/useAuth'
import { useQuery } from '@tanstack/react-query'

export const useCurrentUser = () => {
  const client = useApiService()
  const auth = useAuth()
  const setUser = useUserStore((state) => state.setUser)

  // Fetching current user data
  const query = useQuery({
    queryKey: ['currentUser', auth.user?.access_token],
    queryFn: async () => {
      const response = await client.get(apiRoutes.currentUser)
      return response.data
    },
    enabled: !auth.isLoading && auth.isAuthenticated && !!auth.user?.access_token,
    retry: false,
    onSuccess: setUser,
    onError: (error) => {
      console.error('Error fetching current user:', error)
    }
  })

  /**
   * Checks if the current user has all the specified roles.
   *
   * @param {...string} roleNames - The names of the roles to check against.
   * @return {boolean} True if the user has all the roles.
   *
   * Usage:
   * Check if the user has both the 'Government' and 'Administrator' roles:
   *   import { roles } from '@/constants/roles'
   *   import { useCurrentUser } from '@/hooks/useCurrentUser'
   *
   *   const { hasRoles } = useCurrentUser();
   *
   *   if (hasRoles(roles.government, roles.administrator)) {
   *     // Logic for users with both 'Government' and 'Administrator' roles
   *   }
   */
  const hasRoles = (...roleNames) => {
    return roleNames.every((roleName) =>
      query.data?.roles?.some((role) => role.name === roleName)
    )
  }

  /**
   * Checks if the current user has any of the specified roles.
   *
   * @param {...string} roleNames - The names of the roles to check against.
   * @return {boolean} True if the user has at least one of the roles.
   *
   * Usage:
   * Check if the user has either the 'Transfers' or 'Signing Authority' role:
   *   const { hasAnyRole } = useCurrentUser();
   *
   *   if (hasAnyRole(roles.transfers, roles.signing_authority)) {
   *     // Logic for users with either 'Transfers' or 'Signing Authority' role
   *   }
   */
  const hasAnyRole = (...roleNames) => {
    return roleNames.some((roleName) =>
      query.data?.roles?.some((role) => role.name === roleName)
    )
  }

  const fullName = () => {
    return query.data?.firstName + ' ' + query.data?.lastName
  }

  const sameOrganization = (orgId) => {
    return query.data?.organization?.organizationId === orgId
  }

  return {
    ...query,
    hasRoles,
    hasAnyRole,
    sameOrganization,
    fullName
  }
}
