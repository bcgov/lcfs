import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useOrganization = (orgID, options) => {
  const client = useApiService()
  const { data: currentUser } = useCurrentUser()
  const id = orgID ?? currentUser?.organization?.organization_id

  return useQuery({
    queryKey: ['organization', id],
    queryFn: async () => (await client.get(`/organizations/${id}`)).data,
    ...options
  })
}

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

export const useOrganizationUser = (orgID, userID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-user'],
    queryFn: async () => (await client.get(`/organization/${orgID}/users/${userID}`)).data,
    ...options
  })
}
