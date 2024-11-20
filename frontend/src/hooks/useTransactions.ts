import { roles } from '@/constants/roles'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { TransactionsService } from '@/services/apiClient'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useTransactionStatuses = () => {
  const { hasRoles } = useCurrentUser()

  return useQuery({
    queryKey: ['transaction-statuses'],
    queryFn: async () => {
      const { data } = await TransactionsService.getTransactionStatuses()
      if (hasRoles(roles.supplier)) {
        return data?.filter(
          (val) => val.status !== TRANSFER_STATUSES.RECOMMENDED
        )
      } else {
        return data?.filter(
          (val) =>
            ![
              TRANSFER_STATUSES.DELETED,
              TRANSFER_STATUSES.DRAFT,
              TRANSFER_STATUSES.SENT
            ].includes(val.status)
        )
      }
    }
  })
}
