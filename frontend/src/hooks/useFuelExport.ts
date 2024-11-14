import {
  FuelExportCreateUpdateSchema,
  FuelExportsService,
  PaginationRequestSchema
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useFuelExportOptions = (params: { compliancePeriod: string }) => {
  // const client = useApiService()
  // const path =
  //   apiRoutes.fuelExportOptions + 'compliancePeriod=' + params.compliancePeriod
  return useQuery({
    queryKey: ['fuel-export-options'],
    // queryFn: async () => (await client.get(path)).data,
    queryFn: async () => {
      try {
        const { data } = await FuelExportsService.getFuelExportTableOptions({
          query: { compliancePeriod: params.compliancePeriod }
        })

        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useGetFuelExports = (
  params: number | ({ complianceReportId: number } & PaginationRequestSchema),
  pagination: number
) => {
  // const client = useApiService()
  return useQuery({
    queryKey: ['fuel-exports', params, pagination],
    // queryFn: async () => {
    //   const response = await client.post(apiRoutes.getAllFuelExports, {
    //     ...(typeof params === 'string' && { complianceReportId: params }),
    //     ...(typeof params !== 'string' && params),

    //   })
    //   return response.data
    // },
    queryFn: async () => {
      try {
        let body

        if (typeof params === 'number') {
          body = {
            complianceReportId: params
          }
        } else {
          body = params
        }

        const { data } = await FuelExportsService.getFuelExports({ body })

        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useSaveFuelExport = (complianceReportId: number) => {
  // const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    // mutationFn: async (data) => {
    //   const modifedData = {
    //     complianceReportId: complianceReportId,
    //     ...data
    //   }

    //   return await client.post(
    //     apiRoutes.saveFuelExports,
    //     modifedData
    //   )
    // },
    mutationFn: async (
      data: Omit<FuelExportCreateUpdateSchema, 'complianceReportId'>
    ) => {
      try {
        const body = {
          complianceReportId,
          ...data
        }
        await FuelExportsService.saveFuelExportRow({ body })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['fuel-exports', complianceReportId]
      })
      queryClient.invalidateQueries({
        queryKey: ['compliance-report-summary', complianceReportId]
      })
    }
  })
}
