import {
  ComplianceReportCreateSchema,
  ComplianceReportsService,
  ComplianceReportSummarySchema,
  ComplianceReportUpdateSchema,
  DocumentsService,
  OrganizationService
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useCompliancePeriod = () => {
  return useQuery({
    queryKey: ['compliance-periods'],
    queryFn: async () => {
      try {
        const { data } = await ComplianceReportsService.getCompliancePeriods()

        return data
      } catch (error) {
        console.log(123, error)
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000 // 10 minutes (optional)
  })
}

export const useListComplianceReports = ({ orgId }: { orgId: number }) => {
  return useQuery({
    enabled: !!orgId,
    queryKey: ['compliance-reports', orgId],
    queryFn: async () => {
      try {
        const { data } = await OrganizationService.getOrgComplianceReports({
          path: { organization_id: orgId },
          body: {
            filters: [],
            page: 0,
            size: 20,
            sortOrders: []
          }
        })
        return data
      } catch (error) {
        console.log(123, error)
      }
    }
  })
}

export const useCreateComplianceReport = ({ orgId }: { orgId: number }) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: ComplianceReportCreateSchema) => {
      try {
        await OrganizationService.createComplianceReport({
          path: { organization_id: orgId },
          body: data
        })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-report'] })
    }
  })
}

export const useGetComplianceReport = ({
  orgId,
  reportId
}: {
  orgId: number
  reportId: number
}) => {
  return useQuery({
    enabled: !!orgId,
    queryKey: ['compliance-report', reportId],
    queryFn: async () => {
      try {
        if (orgId) {
          const { data } = await OrganizationService.getOrgComplianceReportById(
            {
              path: { organization_id: orgId, report_id: reportId }
            }
          )
          return data
        } else {
          const { data } =
            await ComplianceReportsService.getComplianceReportById({
              path: { report_id: reportId }
            })
          return data
        }
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useGetComplianceReportSummary = ({
  reportId
}: {
  reportId: number
}) => {
  return useQuery({
    enabled: !!reportId,
    queryKey: ['compliance-report-summary', reportId],
    queryFn: async () => {
      try {
        const { data } =
          await ComplianceReportsService.getComplianceReportSummary({
            path: { report_id: reportId }
          })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useUpdateComplianceReportSummary = ({
  reportId
}: {
  reportId: number
}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ComplianceReportSummarySchema) => {
      try {
        const { data } =
          await ComplianceReportsService.updateComplianceReportSummary({
            path: { report_id: reportId },
            body
          })
        return data
      } catch (error) {
        console.log(error)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['compliance-report-summary', reportId], data)
    }
  })
}

export const useUpdateComplianceReport = ({
  reportId
}: {
  reportId: number
}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ComplianceReportUpdateSchema) => {
      try {
        await ComplianceReportsService.updateComplianceReport({
          path: { report_id: reportId },
          body: data
        })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['compliance-report', reportId]
      })
    }
  })
}

export const useComplianceReportDocuments = ({
  complianceReportId
}: {
  complianceReportId: number
}) => {
  return useQuery({
    queryKey: ['documents', 'compliance_report', complianceReportId],
    queryFn: async () => {
      try {
        const { data } = await DocumentsService.getAllDocuments({
          path: {
            parent_id: complianceReportId,
            parent_type: 'compliance_report'
          }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useCreateSupplementalReport = ({
  reportId
}: {
  reportId: number
}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      try {
        await ComplianceReportsService.createSupplementalReport({
          path: { report_id: reportId }
        })
      } catch (error) {
        console.log(error)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-reports'] })
    }
  })
}
