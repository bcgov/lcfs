import {
  FuelSuppliesService,
  FuelSupplyCreateUpdateSchema
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useFuelSupplyOptions = (compliancePeriod: string) => {
  return useQuery({
    queryKey: ['fuel-supply-options'],
    queryFn: async () => {
      try {
        const { data } = await FuelSuppliesService.getFsTableOptions({
          query: { compliancePeriod }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useGetFuelSupplies = ({
  complianceReportId
}: {
  complianceReportId: string
}) => {
  return useQuery({
    queryKey: ['fuel-supplies', complianceReportId],
    queryFn: async () => {
      try {
        const { data } = await FuelSuppliesService.getFuelSupply({
          body: { complianceReportId: +complianceReportId }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useSaveFuelSupply = (complianceReportId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: FuelSupplyCreateUpdateSchema) => {
      try {
        const body = {
          ...data,
          complianceReportId: +complianceReportId
        }

        return await FuelSuppliesService.saveFuelSupplyRow({
          body
        })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['fuel-supplies', complianceReportId]
      })
      queryClient.invalidateQueries({
        queryKey: ['compliance-report-summary', complianceReportId]
      })
    }
  })
}
