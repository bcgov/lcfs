import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useFuelSupplyOptions = (params, options) => {
  const client = useApiService()
  const path =
    apiRoutes.fuelSupplyOptions + 'compliancePeriod=' + params.compliancePeriod
  return useQuery({
    queryKey: ['fuel-supply-options', params.compliancePeriod],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useGetFuelSupplies = (complianceReportId, pagination, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-supplies', complianceReportId, pagination],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllFuelSupplies, {
        complianceReportId,
        ...pagination
      })
      return response.data
    },
    ...options
  })
}

export const useSaveFuelSupply = (params, options) => {
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
        apiRoutes.saveFuelSupplies
          .replace(':orgID', currentUser.organization.organizationId)
          .replace(':reportID', params.complianceReportId),
        modifedData
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries([
        'fuel-supplies',
        params.complianceReportId
      ])
      queryClient.invalidateQueries([
        'compliance-report-summary',
        params.complianceReportId
      ])
    }
  })
}

export const useGetChangelog = ({ complianceReportID, selection }) => {
  console.log(
    apiRoutes.getChangelog
      .replace(':reportID', complianceReportID)
      .replace(':selection', selection)
  )
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-supply-changelog', complianceReportID],
    queryFn: async () => {
      const response = await client.get(
        apiRoutes.getChangelog
          .replace(':reportID', complianceReportID)
          .replace(':selection', selection)
      )
      return response.data
    }
  })
}
