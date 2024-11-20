import {
  FuelCodeCreateSchema,
  FuelCodesService,
  PaginationRequestSchema
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useFuelCodeOptions = () => {
  return useQuery({
    queryKey: ['fuel-code-options'],
    queryFn: async () => {
      try {
        const { data } = await FuelCodesService.getFuelCodeTableOptions()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useGetFuelCode = ({ fuelCodeId }: { fuelCodeId: number }) => {
  return useQuery({
    queryKey: ['fuel-code', fuelCodeId],
    queryFn: async () => {
      try {
        const { data } = await FuelCodesService.getFuelCode({
          path: { fuel_code_id: fuelCodeId }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useUpdateFuelCode = ({ fuelCodeId }: { fuelCodeId: number }) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FuelCodeCreateSchema) => {
      try {
        await FuelCodesService.updateFuelCode({
          path: { fuel_code_id: fuelCodeId },
          body: data
        })
      } catch (error) {
        console.log(error)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-code', fuelCodeId] })
    }
  })
}

export const useDeleteFuelCode = ({ fuelCodeId }: { fuelCodeId: number }) => {
  return useMutation({
    mutationFn: async () => {
      try {
        await FuelCodesService.deleteFuelCode({
          path: { fuel_code_id: fuelCodeId }
        })
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useSaveFuelCode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: FuelCodeCreateSchema) => {
      try {
        await FuelCodesService.saveFuelCodeRow({ body: data })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-codes'] })
    }
  })
}

export const useGetFuelCodes = (params: PaginationRequestSchema = {}) => {
  return useQuery({
    queryKey: ['fuel-codes', params],
    queryFn: async () => {
      try {
        const { data } = await FuelCodesService.getFuelCodes({ body: params })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}
