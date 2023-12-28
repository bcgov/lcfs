import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useOrganization = (orgID, options) => {
  const client = useApiService()
  const { data: currentUser } = useCurrentUser()
  const id = orgID ?? currentUser.organization.organization_id

  return useQuery({
    queryKey: ['organization', id],
    queryFn: async () => (await client.get(`/organizations/${id}`)).data,
    ...options
  })
}
