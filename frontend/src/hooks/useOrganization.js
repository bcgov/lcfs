import { useApiService } from '@/services/useApiService'
import { useQuery } from 'react-query'

export const useOrganization = (orgID, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['organization', orgID],
    queryFn: async () => (await client.get(`/organizations/${orgID}`)).data,
    ...options
  })
}
