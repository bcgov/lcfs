import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'

export const useOrganizationStatuses = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-statuses'],
    queryFn: async () => (await client.get('/organizations/statuses/')).data,
    ...options
  })
}

export const useOrganizationListStatuses = (options) => {
  const { data, isLoading, ...rest } = useOrganizationStatuses(options)

  const validStatuses = [
    ORGANIZATION_STATUSES.REGISTERED,
    ORGANIZATION_STATUSES.UNREGISTERED
  ]

  const filteredData = data?.filter((status) =>
    validStatuses.includes(status.status)
  )

  return {
    data: filteredData,
    isLoading,
    ...rest
  }
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

export const useOrganizationsList = (paginationOptions, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organizations-list', paginationOptions],
    queryFn: async () => {
      const response = await client.post('/organizations/', paginationOptions)
      return response.data
    },
    ...options
  })
}

export const useOrganizationUsers = (orgID, paginationOptions, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-users', orgID, paginationOptions],
    queryFn: async () => {
      const response = await client.post(
        `/organization/${orgID}/users/list`,
        paginationOptions
      )
      return response.data
    },
    enabled: !!orgID,
    ...options
  })
}
