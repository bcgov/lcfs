import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'

export const useFSEProcessing = (siteId) => {
  const queryClient = useQueryClient()
  const apiService = useApiService()

  const queryKey = siteId ? ['fse-processing', siteId] : ['fse-processing']

  // Query for getting site and equipment data
  const fseProcessingQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!siteId) return null
      const response = await apiService.get(
        `/charging-equipment/charging-sites/${siteId}/equipment-processing`
      )
      return response.data
    },
    enabled: !!siteId,
    staleTime: 30000 // 30 seconds
  })

  // Mutation for bulk validating equipment
  const validateMutation = useMutation({
    mutationFn: async (equipmentIds) => {
      const response = await apiService.post(
        '/charging-equipment/bulk/validate',
        { charging_equipment_ids: equipmentIds }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fse-processing'] })
      queryClient.invalidateQueries({ queryKey: ['charging-equipment'] })
    }
  })

  // Mutation for bulk returning to draft
  const returnToDraftMutation = useMutation({
    mutationFn: async (equipmentIds) => {
      const response = await apiService.post(
        '/charging-equipment/bulk/return-to-draft',
        { charging_equipment_ids: equipmentIds }
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fse-processing'] })
      queryClient.invalidateQueries({ queryKey: ['charging-equipment'] })
    }
  })

  return {
    // Query data
    data: fseProcessingQuery.data,
    isLoading: fseProcessingQuery.isLoading,
    isError: fseProcessingQuery.isError,
    error: fseProcessingQuery.error,
    refetch: fseProcessingQuery.refetch,

    // Mutation functions
    validateEquipment: validateMutation.mutateAsync,
    returnToDraft: returnToDraftMutation.mutateAsync,
    isValidating: validateMutation.isPending,
    isReturningToDraft: returnToDraftMutation.isPending
  }
}