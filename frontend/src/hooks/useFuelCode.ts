import {
  FuelCodeCreateUpdateSchema,
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
    enabled: !!fuelCodeId,
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

export const useCreateFuelCode = () => {
  return useMutation({
    mutationFn: async (data: FuelCodeCreateUpdateSchema) => {
      try {
        return await FuelCodesService.saveFuelCode({ body: data })
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useUpdateFuelCode = ({ fuelCodeId }: { fuelCodeId: number }) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FuelCodeCreateUpdateSchema) => {
      try {
        await FuelCodesService.saveFuelCode({
          body: {
            ...data,
            fuelCodeId
          }
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

export const useApproveFuelCode = ({ fuelCodeId }: { fuelCodeId: number }) => {
  return useMutation({
    mutationFn: async () => {
      try {
        return await FuelCodesService.approveFuelCode({
          path: { fuel_code_id: fuelCodeId }
        })
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useDeleteFuelCode = () => {
  return useMutation({
    mutationFn: async (fuelCodeId: number) => {
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
