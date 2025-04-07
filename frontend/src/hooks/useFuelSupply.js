import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery } from '@tanstack/react-query'

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
  options
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
  return useMutation({
    ...options,
    mutationFn: async (data) => {
      const modifedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }

      return await client.post(apiRoutes.saveFuelSupplies, modifedData)
    }
  })
}

export const useGetFuelSupplyChangeLog = ({ complianceReportGroupUuid }) => {
  const client = useApiService()
  const path = apiRoutes.getFuelSupplyChangelog.replace(
    ':complianceReportGroupUuid',
    complianceReportGroupUuid
  )
  return useQuery({
    queryKey: ['fuel-supply-changelog', complianceReportGroupUuid],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    }
  })
}
