import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import type { QueryOptions } from './types'

export const useAuditLogs = ({ page = 1, size = 10, sortOrders = [], filters = [] }: any = {}, options: QueryOptions<unknown>) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['audit-logs', page, size, sortOrders, filters],
    queryFn: async () =>
      (
        await client.post(apiRoutes.getAuditLogs, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data,
    ...options
  })
}

export const useAuditLog = (auditLogId: number | string | undefined | null, options: QueryOptions<unknown>) => {
  const client = useApiService()
  const path = apiRoutes.getAuditLog.replace(':auditLogId', String(auditLogId ?? ''))
  return useQuery({
    queryKey: ['audit-log', auditLogId],
    queryFn: () => client.get(path).then((res) => res.data),
    enabled: !!auditLogId,
    ...options
  })
}
