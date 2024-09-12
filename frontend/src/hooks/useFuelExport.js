import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useFuelExportOptions = (params, options) => {
  const client = useApiService()
  const path =
    apiRoutes.fuelExportOptions + 'compliancePeriod=' + params.compliancePeriod
  return useQuery({
    queryKey: ['fuel-export-options'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useGetFuelExports = (complianceReportId, pagination, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-exports', complianceReportId, pagination],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllFuelExports, {
        complianceReportId,
        ...pagination
      })
      return response.data
    },
    ...options
  })
}

export const useSaveFuelExport = (params, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      const modifedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }
      return await client.post(
        apiRoutes.saveFuelExports
          .replace(':orgID', currentUser.organization.organizationId)
          .replace(':reportID', params.complianceReportId),
        modifedData
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries(['fuel-exports', params.complianceReportId])
      queryClient.invalidateQueries([
        'compliance-report-summary',
        params.complianceReportId
      ])
    }
  })
}
