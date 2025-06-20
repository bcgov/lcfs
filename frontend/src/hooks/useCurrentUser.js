import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useUserStore } from '@/stores/useUserStore'
import { useKeycloak } from '@react-keycloak/web'
import { useQuery } from '@tanstack/react-query'

export const useCurrentUser = () => {
  const client = useApiService()
  const { keycloak, initialized } = useKeycloak()
  const setUser = useUserStore((state) => state.setUser)

  // Fetching current user data
  const query = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await client.get(apiRoutes.currentUser)
      const userData = response.data
      setUser(userData) // Set user data in store on successful fetch
      return userData
    },
    enabled: !!keycloak.authenticated && initialized,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes - cache persists for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false // Don't refetch on component mount if data exists
  })

  // Handle errors
  if (query.error) {
    console.error('Error fetching current user:', query.error)
  }

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
    return query.data ? `${query.data.firstName} ${query.data.lastName}` : ''
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
