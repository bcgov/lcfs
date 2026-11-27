import { useApiService } from '@/services/useApiService'
import type { AxiosResponse } from 'axios'
import type { TransferRecord as TransferViewRecord } from '@/views/Transfers/buttonConfigs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryOptions, ExtMutationOptions } from './types'

export interface TransferCategoryUpdate {
  category: string
  isA1Category: boolean
}

export type TransferRecord = TransferViewRecord & {
  transferId?: number | string
}

export type TransferMutationResponse = AxiosResponse<{
  transferId: number | string
  currentStatus: { status: string }
}>

type TransferCategoryInput = string | TransferCategoryUpdate

export const useTransfer = (
  transferID: number | string | undefined | null,
  options: QueryOptions<TransferRecord> = {}
) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transfer', transferID],
    queryFn: async () => (await client.get(`/transfers/${transferID}`)).data,
    ...options
  })
}

export const useCreateUpdateTransfer = (
  orgId: number | string | undefined | null,
  transferId: number | string | undefined | null = undefined,
  options: ExtMutationOptions<
    TransferMutationResponse,
    Record<string, unknown>
  > = {}
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }: Record<string, unknown>) => {
      if (orgId) {
        if (transferId) {
          return await client.put(
            `organization/${orgId}/transfers/${transferId}`,
            data
          )
        }
        return await client.post(`organization/${orgId}/transfers`, data)
      }
      return await client.put(`transfers/${transferId}`, data)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer', transferId] })
      queryClient.invalidateQueries({ queryKey: ['current-org-balance'] })
    }
  })
}

export const useUpdateCategory = (
  transferId: number | string | undefined | null,
  options: ExtMutationOptions<unknown, TransferCategoryInput>
) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (category: TransferCategoryInput) => {
      return await client.put(`transfers/${transferId}/category`, category)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer', transferId] })
    }
  })
}
