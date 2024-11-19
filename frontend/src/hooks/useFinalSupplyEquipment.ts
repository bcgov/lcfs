import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  FinalSupplyEquipmentCreateSchema,
  FinalSupplyEquipmentsService
} from '@/services/apiClient'

export const useFinalSupplyEquipmentOptions = () => {
  return useQuery({
    queryKey: ['final-supply-equipment-options'],
    queryFn: async () => {
      try {
        const { data } = await FinalSupplyEquipmentsService.getFseOptions()

        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useGetFinalSupplyEquipments = ({
  complianceReportId
}: {
  complianceReportId: number
}) => {
  return useQuery({
    queryKey: ['final-supply-equipments', complianceReportId],
    queryFn: async () => {
      try {
        const { data } =
          await FinalSupplyEquipmentsService.getFinalSupplyEquipments({
            body: {
              complianceReportId
            }
          })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useSaveFinalSupplyEquipment = (complianceReportId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FinalSupplyEquipmentCreateSchema) => {
      const body = {
        ...data,
        levelOfEquipment: data.levelOfEquipment,
        fuelMeasurementType: data.fuelMeasurementType,
        complianceReportId: +complianceReportId
      }

      try {
        return await FinalSupplyEquipmentsService.saveFinalSupplyEquipmentRow({
          body
        })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['final-supply-equipments', complianceReportId]
      })
      queryClient.invalidateQueries({
        queryKey: ['compliance-report-summary', complianceReportId]
      })
    }
  })
}
