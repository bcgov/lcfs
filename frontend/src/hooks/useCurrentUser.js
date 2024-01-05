import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useUserStore } from '@/stores/useUserStore'
import { useKeycloak } from '@react-keycloak/web'
import { useQuery } from '@tanstack/react-query'

export const useCurrentUser = () => {
  const client = useApiService()
  const { keycloak } = useKeycloak()
  const setUser = useUserStore((state) => state.setUser)

  const query = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      return (await client.get(apiRoutes.currentUser)).data
    },
    enabled: !!keycloak.authenticated,
    retry: false
  })

  if (query.isError) {
    console.error('Error fetching current user:', query.error)
  }
  if (query.isSuccess) {
    setUser(query.data)
  }

  return query
}
