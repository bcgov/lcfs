import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useAllocationAgreementOptions = (params, options) => {
  const client = useApiService()
  const path = apiRoutes.allocationAgreementOptions + 'compliancePeriod=' + params.compliancePeriod
  return useQuery({
    queryKey: ['allocation-agreement-options'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useGetAllocationAgreements = (complianceReportId, pagination, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['allocation-agreements', complianceReportId, pagination],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllAllocationAgreements, { complianceReportId, ...pagination })
      return response.data
    },
    ...options
  })
}

export const useSaveAllocationAgreement = (params, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      const modifiedData = {
        complianceReportId: params.complianceReportId,
        ...data,
      }
      return await client.post(
        apiRoutes.saveAllocationAgreements
          .replace(':orgID', currentUser.organization.organizationId)
          .replace(':reportID', params.complianceReportId),
        modifiedData
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries(['allocation-agreements', params.complianceReportId])
      queryClient.invalidateQueries(['compliance-report-summary', params.complianceReportId])
    }
  })
}
