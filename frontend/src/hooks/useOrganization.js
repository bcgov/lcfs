import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useOrganization = (orgID, options) => {
  const client = useApiService()
  const { data: currentUser } = useCurrentUser()
  const id = orgID ?? currentUser?.organization?.organizationId

  return useQuery({
    queryKey: ['organization', id],
    queryFn: async () => (await client.get(`/organizations/${id}`)).data,
    ...options
  })
}

export const useOrganizationUser = (orgID, userID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-user'],
    queryFn: async () =>
      (await client.get(`/organization/${orgID}/users/${userID}`)).data,
    ...options
  })
}

export const useOrganizationBalance = (orgID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-balance', orgID],
    queryFn: async () =>
      orgID ? (await client.get(`/organizations/balances/${orgID}`)).data : {},
    ...options
  })
}
export const useCurrentOrgBalance = (options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['current-org-balance'],
    queryFn: async () =>
      (await client.get(`/organizations/current/balances`)).data,
    ...options
  })
}

export const useGetOrgComplianceReportReportedYears = (orgID, options) => {
  const client = useApiService()
  const path = apiRoutes.getOrgComplianceReportReportedYears.replace(
    ':orgID',
    orgID
  )

  return useQuery({
    queryKey: ['org-compliance-reports', orgID],
    queryFn: async () => {
      return (await client.get(`${path}`)).data
    },
    ...options
  })
}
