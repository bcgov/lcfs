import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useOtherUsesOptions = (params, options) => {
  const client = useApiService()
  const path = apiRoutes.otherUsesOptions
  return useQuery({
    queryKey: ['other-uses-options'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useGetAllOtherUses = (complianceReportId, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['other-uses', complianceReportId],
    queryFn: async () => {
      return (
        await client.post(apiRoutes.getAllOtherUses, { complianceReportId })
      ).data.otherUses
    },
    ...options
  })
}

export const useSaveOtherUses = (options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.post(apiRoutes.saveOtherUses, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['other-uses'])
    },
  })
}
