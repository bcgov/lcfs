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

export const useOrganizationNames = (statuses = null, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-names', statuses],
    queryFn: async () => {
      let url = `/organizations/names/`
      if (statuses && Array.isArray(statuses)) {
        const statusParams = statuses
          .map((status) => `statuses=${status}`)
          .join('&')
        url += `?${statusParams}`
      }
      const response = await client.get(url)
      return response.data
    },
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
