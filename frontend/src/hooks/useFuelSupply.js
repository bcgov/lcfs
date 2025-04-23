import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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

export const useGetFuelSuppliesList = (
  { complianceReportId, changelog = false },
  pagination,
  options = {}
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-supplies', complianceReportId, changelog],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllFuelSupplies, {
        complianceReportId,
        changelog,
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

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      const modifedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }

      return await client.post(apiRoutes.saveFuelSupplies, modifedData)
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
