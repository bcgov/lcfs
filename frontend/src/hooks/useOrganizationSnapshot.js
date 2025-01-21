import { useApiService } from '@/services/useApiService.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRoutes } from '@/constants/routes/index.js'

export const useOrganizationSnapshot = (complianceReportId, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['organization-snapshot', complianceReportId],
    queryFn: async () =>
      (
        await client.get(
          `${apiRoutes.getOrganizationSnapshot.replace(
            ':reportID',
            complianceReportId
          )}`
        )
      ).data,
    ...options
  })
}

export const useUpdateOrganizationSnapshot = (reportID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.getOrganizationSnapshot.replace(':reportID', reportID)

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.put(path, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['organization-snapshot', reportID])
    }
  })
}
