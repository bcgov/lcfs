import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'

export const useOrganizationStatuses = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-statuses'],
    queryFn: async () => (await client.get('/organizations/statuses/')).data,
    ...options
  })
}

export const useOrganizationNames = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-names'],
    queryFn: async () => (await client.get('/organizations/names/')).data,
    ...options
  })
}

export const useRegExtOrgs = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['registered-external-orgs'],
    queryFn: async () =>
      (await client.get('/organizations/registered/external')).data,
    initialData: [],
    ...options
  })
}
