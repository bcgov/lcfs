import {
  NotionalTransferCreateSchema,
  NotionalTransfersService,
  PaginationRequestSchema
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useNotionalTransferOptions = () => {
  return useQuery({
    queryKey: ['notional-transfer-options'],
    queryFn: async () => {
      try {
        const { data } =
          await NotionalTransfersService.getNotionalTransferTableOptions()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useGetAllNotionalTransfers = ({
  complianceReportId
}: {
  complianceReportId: number
}) => {
  return useQuery({
    enabled: !!complianceReportId,
    queryKey: ['notional-transfers', complianceReportId],
    queryFn: async () => {
      try {
        const { data } = await NotionalTransfersService.getNotionalTransfers({
          body: { complianceReportId }
        })

        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useSaveNotionalTransfer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: NotionalTransferCreateSchema) => {
      try {
        await NotionalTransfersService.saveNotionalTransferRow({ body: data })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['notional-transfers']
      })
      queryClient.invalidateQueries({
        queryKey: ['compliance-report-summary']
      })
    }
  })
}

export const useGetNotionalTransfers = (
  params: { complianceReportId: number } & PaginationRequestSchema
) => {
  return useQuery({
    queryKey: ['notional-transfers', params],
    queryFn: async () => {
      try {
        const { data } =
          await NotionalTransfersService.getNotionalTransfersPaginated({
            body: params
          })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}
