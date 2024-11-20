import {
  AllocationAgreementCreateSchema,
  AllocationAgreementsService,
  PaginationRequestSchema
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useAllocationAgreementOptions = ({
  compliancePeriod
}: {
  compliancePeriod: string
}) => {
  return useQuery({
    queryKey: ['allocation-agreement-options'],
    queryFn: async () => {
      try {
        const { data } =
          await AllocationAgreementsService.getAllocationAgreementTableOptions({
            query: { compliancePeriod }
          })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useGetAllocationAgreements = ({
  complianceReportId,
  pagination = {}
}: {
  complianceReportId: number
  pagination: PaginationRequestSchema
}) => {
  return useQuery({
    queryKey: ['allocation-agreements', complianceReportId, pagination],
    queryFn: async () => {
      try {
        const { data } =
          await AllocationAgreementsService.getAllocationAgreements({
            body: { complianceReportId, ...pagination }
          })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useSaveAllocationAgreement = ({
  complianceReportId
}: {
  complianceReportId: number
}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      data: Omit<AllocationAgreementCreateSchema, 'complianceReportId'>
    ) => {
      try {
        const body = {
          complianceReportId: +complianceReportId,
          ...data
        }

        await AllocationAgreementsService.saveAllocationAgreementsRow({ body })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['allocation-agreements', complianceReportId]
      })
      queryClient.invalidateQueries({
        queryKey: ['compliance-report-summary', complianceReportId]
      })
    }
  })
}
