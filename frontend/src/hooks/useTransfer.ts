import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryOptions , ExtMutationOptions} from './types'

export const useTransfer = (transferID: number | string | undefined | null, options: QueryOptions<unknown>) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['transfer', transferID],
    queryFn: async () => (await client.get(`/transfers/${transferID}`)).data,
    ...options
  })
}

export const useCreateUpdateTransfer = (orgId: number | string | undefined | null, transferId: number | string | undefined | null, options: ExtMutationOptions<unknown, any>) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    ...options,
    mutationFn: async ({ data }: any) => {
      if (orgId && transferId) {
        return await client.put(
          `organization/${orgId}/transfers/${transferId}`,
          data
        )
      }

      if (orgId && !transferId) {
        return await client.post(`organization/${orgId}/transfers`, data)
      }

      if (!orgId) {
        return await client.put(`transfers/${transferId}`, data)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer', transferId] })
      queryClient.invalidateQueries({ queryKey: ['current-org-balance'] })
    }
  })
}

export const useUpdateCategory = (transferId: number | string | undefined | null, options: ExtMutationOptions<unknown, any>) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (category: any) => {
      return await client.put(`transfers/${transferId}/category`, category)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer', transferId] })
    }
  })
}
