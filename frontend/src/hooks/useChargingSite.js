import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'

export const useChargingSite = (siteId) => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-site', siteId],
    queryFn: () => apiService.get(`/charging-sites/${siteId}`),
    select: (response) => response.data,
    enabled: !!siteId
  })
}

export const useChargingSiteStatuses = () => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-site-statuses'],
    queryFn: () => apiService.get('/charging-sites/statuses/'),
    select: (response) => response.data,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export const useBulkUpdateEquipmentStatus = () => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ siteId, equipment_ids, new_status }) =>
      apiService.post(
        `/charging-sites/${siteId}/equipment/bulk-status-update`,
        {
          equipment_ids,
          new_status
        }
      ),
    onSuccess: (_, { siteId }) => {
      // Invalidate and refetch charging site data
      queryClient.invalidateQueries({ queryKey: ['charging-site', siteId] })
      queryClient.invalidateQueries({ queryKey: ['charging-sites'] })
      queryClient.invalidateQueries({
        queryKey: ['charging-site-equipment-paginated', siteId]
      })
    },
    onError: (error) => {
      console.error('Failed to bulk update equipment status:', error)
    }
  })
}

export const useChargingSiteEquipmentPaginated = (
  siteId,
  paginationOptions,
  options
) => {
  const apiService = useApiService()

  return useQuery({
    queryKey: ['charging-site-equipment-paginated', siteId, paginationOptions],
    queryFn: async () => {
      const url = apiRoutes.getChargingSiteEquipmentPaginated.replace(
        ':siteId',
        siteId
      )
      const response = await apiService.post(url, paginationOptions)
      return response.data
    },
    enabled: !!siteId,
    staleTime: 30000, // 30 seconds
    ...options
  })
}
