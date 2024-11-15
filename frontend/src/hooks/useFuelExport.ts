import {
  FuelExportCreateUpdateSchema,
  FuelExportsService,
  PaginationRequestSchema
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useFuelExportOptions = ({
  compliancePeriod
}: {
  compliancePeriod: string
}) => {
  return useQuery({
    queryKey: ['fuel-export-options'],
    queryFn: async () => {
      try {
        const { data } = await FuelExportsService.getFuelExportTableOptions({
          query: { compliancePeriod }
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
  return useQuery({
    queryKey: ['fuel-exports', params, pagination],
    queryFn: async () => {
      try {
        let body

        if (typeof params === 'number') {
          body = {
            complianceReportId: params
          }
        } else if (typeof params === 'string') {
          body = {
            complianceReportId: +params
          }
        } else {
          // BCGridViewer passes in object. TODO modify BCGridViewer
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      data: Omit<FuelExportCreateUpdateSchema, 'complianceReportId'>
    ) => {
      try {
        const body = {
          complianceReportId,
          ...data
        }
        console.log(body)
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
