import { AuditLogService, PaginationRequestSchema } from '@/services/apiClient'
import { useQuery } from '@tanstack/react-query'

export const useAuditLogs = (params: PaginationRequestSchema = {}) => {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      try {
        const { data } = await AuditLogService.getAuditLogsPaginated({
          body: params
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

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
