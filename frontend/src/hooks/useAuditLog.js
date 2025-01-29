import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'

export const useAuditLogs = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
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

export const useAuditLog = (auditLogId, options) => {
  const client = useApiService()
  const path = apiRoutes.getAuditLog.replace(':auditLogId', auditLogId)
  return useQuery({
    queryKey: ['audit-log', auditLogId],
    queryFn: () => client.get(path).then((res) => res.data),
    enabled: !!auditLogId,
    ...options
  })
}
