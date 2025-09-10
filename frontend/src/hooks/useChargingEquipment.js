import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'

export const useChargingEquipment = (paginationOptions) => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  // Get charging equipment list
  const equipmentQuery = useQuery({
    queryKey: ['charging-equipment', paginationOptions],
    queryFn: async () => {
      const response = await apiService.post(
        apiRoutes.chargingEquipment.list,
        {
          ...paginationOptions,
          filters: paginationOptions?.filters || {}
        }
      )
      return response.data
    },
    enabled: !!paginationOptions,
    keepPreviousData: true
  })

  // Submit equipment mutation
  const submitMutation = useMutation({
    mutationFn: async (equipmentIds) => {
      const response = await apiService.post(
        apiRoutes.chargingEquipment.bulkSubmit,
        { charging_equipment_ids: equipmentIds }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['charging-equipment'])
    }
  })

  // Decommission equipment mutation
  const decommissionMutation = useMutation({
    mutationFn: async (equipmentIds) => {
      const response = await apiService.post(
        apiRoutes.chargingEquipment.bulkDecommission,
        { charging_equipment_ids: equipmentIds }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['charging-equipment'])
    }
  })

  return {
    data: equipmentQuery.data,
    isLoading: equipmentQuery.isLoading,
    isError: equipmentQuery.isError,
    error: equipmentQuery.error,
    refetch: equipmentQuery.refetch,
    submitEquipment: submitMutation.mutateAsync,
    decommissionEquipment: decommissionMutation.mutateAsync,
    isSubmitting: submitMutation.isLoading,
    isDecommissioning: decommissionMutation.isLoading
  }
}

// Get single charging equipment
export const useGetChargingEquipment = (id) => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-equipment', id],
    queryFn: async () => {
      const response = await apiService.get(
        apiRoutes.chargingEquipment.get.replace(':id', id)
      )
      return response.data
    },
    enabled: !!id
  })
}

// Create charging equipment
export const useCreateChargingEquipment = () => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      const response = await apiService.post(
        apiRoutes.chargingEquipment.create,
        data
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['charging-equipment'])
    }
  })
}

// Update charging equipment
export const useUpdateChargingEquipment = () => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiService.put(
        apiRoutes.chargingEquipment.update.replace(':id', id),
        data
      )
      return response.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['charging-equipment'])
      queryClient.invalidateQueries(['charging-equipment', variables.id])
    }
  })
}

// Delete charging equipment
export const useDeleteChargingEquipment = () => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      await apiService.delete(
        apiRoutes.chargingEquipment.delete.replace(':id', id)
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['charging-equipment'])
    }
  })
}

// Get equipment metadata (statuses, levels, end use types)
export const useChargingEquipmentMetadata = () => {
  const apiService = useApiService()

  const statusesQuery = useQuery({
    queryKey: ['charging-equipment-statuses'],
    queryFn: async () => {
      const response = await apiService.get(apiRoutes.chargingEquipment.statuses)
      return response.data
    }
  })

  const levelsQuery = useQuery({
    queryKey: ['charging-equipment-levels'],
    queryFn: async () => {
      const response = await apiService.get(apiRoutes.chargingEquipment.levels)
      return response.data
    }
  })

  const endUseTypesQuery = useQuery({
    queryKey: ['charging-equipment-end-use-types'],
    queryFn: async () => {
      const response = await apiService.get(apiRoutes.chargingEquipment.endUseTypes)
      return response.data
    }
  })

  return {
    statuses: statusesQuery.data,
    levels: levelsQuery.data,
    endUseTypes: endUseTypesQuery.data,
    isLoading: statusesQuery.isLoading || levelsQuery.isLoading || endUseTypesQuery.isLoading
  }
}

// Get charging sites for dropdown
export const useChargingSites = () => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-sites'],
    queryFn: async () => {
      const response = await apiService.get(apiRoutes.chargingEquipment.chargingSites)
      return response.data
    }
  })
}

// Get organizations for dropdown
export const useOrganizations = () => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['organizations-list'],
    queryFn: async () => {
      const response = await apiService.get(apiRoutes.chargingEquipment.organizations)
      return response.data
    }
  })
}