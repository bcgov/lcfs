import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useFuelExportOptions = (params, options) => {
  const client = useApiService()
  const path =
    apiRoutes.fuelExportOptions + 'compliancePeriod=' + params.compliancePeriod
  return useQuery({
    queryKey: ['fuel-export-options'],
    queryFn: async () => (await client.get(path)).data,
    ...options
  })
}

export const useGetFuelExports = (params, pagination, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-exports', params, pagination],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllFuelExports, {
        ...(typeof params === 'string' && { complianceReportId: params }),
        ...(typeof params !== 'string' && params)
      })
      return response.data
    },
    ...options
  })
}

export const useGetFuelExportsList = (
  { complianceReportId, changelog = false },
  pagination,
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-exports', complianceReportId, changelog],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllFuelExports, {
        complianceReportId,
        changelog,
        ...pagination
      })

      return response.data
    },
    ...options
  })
}

export const useSaveFuelExport = (params, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (data) => {
      const modifedData = {
        complianceReportId: params.complianceReportId,
        ...data
      }
      return await client.post(apiRoutes.saveFuelExports, modifedData)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['fuel-exports', params.complianceReportId])
      queryClient.invalidateQueries([
        'compliance-report-summary',
        params.complianceReportId
      ])
    }
  })
}

export const useGetFuelExportsChangeLog = ({ complianceReportGroupUuid }) => {
  const client = useApiService()
  const path = apiRoutes.getChangelog
    .replace(':complianceReportGroupUuid', complianceReportGroupUuid)
    .replace(':dataType', 'fuel-exports')
  return useQuery({
    queryKey: ['fuel-exports-log', complianceReportGroupUuid],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    }
  })
}
