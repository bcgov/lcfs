import { AuditLogService } from '@/services/apiClient'
import { useQuery } from '@tanstack/react-query'

// export const useAuditLogs = (
//   { page = 1, size = 10, sortOrders = [], filters = [] } = {},
//   options
// ) => {
//   const client = useApiService()
//   return useQuery({
//     queryKey: ['audit-logs', page, size, sortOrders, filters],
//     queryFn: async () =>
//       (
//         await client.post(apiRoutes.getAuditLogs, {
//           page,
//           size,
//           sortOrders,
//           filters
//         })
//       ).data,
//     ...options
//   })
// }

export const useAuditLog = ({ auditLogId }: { auditLogId: number }) => {
  return useQuery({
    queryKey: ['audit-log', auditLogId],
    queryFn: async () => {
      try {
        const { data } = await AuditLogService.getAuditLogById({
          path: { audit_log_id: auditLogId }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    },
    enabled: !!auditLogId
  })
}
