import {
  OrganizationService,
  TransferCreateSchema,
  TransfersService
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useTransfer = ({ transferId }: { transferId: number }) => {
  return useQuery({
    queryKey: ['transfer', transferId],
    queryFn: async () => {
      try {
        const { data } = await TransfersService.getTransfer({
          path: { transfer_id: transferId }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useCreateUpdateTransfer = ({
  orgId,
  transferId
}: {
  orgId: number
  transferId: number
}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: TransferCreateSchema) => {
      try {
        if (orgId && transferId) {
          await OrganizationService.updateTransfer({
            path: { organization_id: orgId, transfer_id: transferId },
            body: data
          })
        }

        if (orgId && !transferId) {
          await OrganizationService.createTransfer({
            path: { organization_id: orgId },
            body: data
          })
        }

        if (!orgId) {
          await TransfersService.governmentUpdateTransfer({
            path: { transfer_id: transferId },
            body: data
          })
        }
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer', transferId] })
      queryClient.invalidateQueries({ queryKey: ['current-org-balance'] })
    }
  })
}

export const useUpdateCategory = ({ transferId }: { transferId: number }) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (category: string) => {
      try {
        await TransfersService.updateCategory({
          path: { transfer_id: transferId },
          body: category
        })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer', transferId] })
    }
  })
}
