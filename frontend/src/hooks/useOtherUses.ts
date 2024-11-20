import {
  OtherUsesCreateSchema,
  OtherUsesService,
  PaginationRequestSchema
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useOtherUsesOptions = () => {
  return useQuery({
    queryKey: ['other-uses-options'],
    queryFn: async () => {
      try {
        const { data } = await OtherUsesService.getOtherUsesTableOptions()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useGetAllOtherUses = ({
  complianceReportId
}: {
  complianceReportId: number
}) => {
  return useQuery({
    queryKey: ['all-other-uses', complianceReportId],
    queryFn: async () => {
      try {
        const { data } = await OtherUsesService.getOtherUses({
          body: {
            complianceReportId: +complianceReportId
          }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useSaveOtherUses = ({
  complianceReportId
}: {
  complianceReportId: number
}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: OtherUsesCreateSchema) => {
      console.log(data)
      return await OtherUsesService.saveOtherUsesRow({ body: data })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['other-uses'] })
      queryClient.invalidateQueries({
        queryKey: ['compliance-report-summary', complianceReportId]
      })
    }
  })
}

export const useGetOtherUses = (
  params: { complianceReportId: number } & PaginationRequestSchema
) => {
  return useQuery({
    queryKey: ['other-uses', params],
    queryFn: async () => {
      try {
        const { data } = await OtherUsesService.getOtherUses({ body: params })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}
