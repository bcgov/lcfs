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
    queryKey: ['currentUser', keycloak.token],
    queryFn: async () => {
      const response = await client.get(apiRoutes.currentUser);
      return response.data;
    },
    enabled: !!keycloak.authenticated && initialized,
    retry: false,
    onSuccess: setUser,
    onError: (error) => {
      console.error('Error fetching current user:', error);
    },
  })

  /**
   * Checks if the current user has all of the specified roles.
   * 
   * @param {string[]} roleNames - The names of the roles to check against.
   * @return {boolean} True if the user has all of the roles.
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
    return roleNames.every(roleName => 
        query.data?.roles?.some(role => role.name === roleName)
    );
  };

  const fullName = () => {
    return query.data?.first_name + ' ' + query.data?.last_name
  }

  const sameOrganization = (orgId) => {
    return query.data?.organization?.organization_id === orgId
  }

  return {
    ...query,
    hasRoles,
    sameOrganization,
    fullName
  };
}
