import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useOtherUsesOptions = (params, options) => {
  const client = useApiService()
  const path =
    apiRoutes.otherUsesOptions + 'compliancePeriod=' + params.compliancePeriod
  return useQuery({
    queryKey: ['other-uses-options', params.compliancePeriod],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useGetAllOtherUses = (complianceReportId, pagination, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['all-other-uses', complianceReportId],
    queryFn: async () => {
      return (
        await client.post(apiRoutes.getAllOtherUses, {
          complianceReportId,
          ...pagination })
      ).data.otherUses
    },
    ...options
  })
}

export const useGetAllOtherUsesList = (
  { complianceReportId, changelog = false },
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['other-uses', complianceReportId, changelog],
    queryFn: async () => {
      return (
        await client.post(apiRoutes.getAllOtherUses, {
          complianceReportId,
          changelog
        })
      ).data.otherUses
    },
    ...options
  })
}

export const useSaveOtherUses = (complianceReportId, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      return await client.post(apiRoutes.saveOtherUses, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['other-uses'])
      queryClient.invalidateQueries([
        'compliance-report-summary',
        complianceReportId
      ])
    }
  })
}

export const useGetOtherUses = (
  {
    page = 1,
    size = 10,
    sortOrders = [],
    filters = [],
    complianceReportId
  } = {},
  options
) => {
  const client = useApiService()
  return useQuery({
    ...options,
    queryKey: ['other-uses', page, size, sortOrders, filters],
    queryFn: async () => {
      return (
        await client.post(apiRoutes.getOtherUses, {
          page,
          size,
          sortOrders,
          filters,
          complianceReportId
        })
      ).data
    }
  })
}
