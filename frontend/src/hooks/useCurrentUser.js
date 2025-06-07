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
    queryKey: ['currentUser'], // Remove token from key to prevent frequent refetches
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
   */
  const hasRoles = (...roleNames) => {
    return roleNames.every((roleName) =>
      query.data?.roles?.some((role) => role.name === roleName)
    )
  }

  /**
   * Checks if the current user has any of the specified roles.
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
