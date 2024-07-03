import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useFinalSupplyEquipmentOptions = (params, options) => {
  const client = useApiService()
  const path = apiRoutes.finalSupplyEquipmentOptions
  return useQuery({
    queryKey: ['final-supply-equipment-options'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useGetFinalSupplyEquipments = (complianceReportId, pagination, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['final-supply-equipments', complianceReportId, pagination],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllFinalSupplyEquipments, { complianceReportId, ...pagination })
      return response.data
    },
    ...options
  })
}

export const useSaveFinalSupplyEquipment = (params, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      const modifedData = {
        ...data,
        levelOfEquipment: data.levelOfEquipment?.name || data.levelOfEquipment,
        fuelMeasurementType: data.fuelMeasurementType?.type || data.fuelMeasurementType
      }
      return await client.post(
        apiRoutes.saveFinalSupplyEquipments
          .replace(':orgID', currentUser.organization.organizationId)
          .replace(':reportID', params.complianceReportId),
          modifedData
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries(['final-supply-equipments', params.complianceReportId])
    }
  })
}
