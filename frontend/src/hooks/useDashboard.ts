import { DashboardService } from '@/services/apiClient'
import { useQuery } from '@tanstack/react-query'

export const useDirectorReviewCounts = () => {
  return useQuery({
    queryKey: ['director-review-counts'],
    queryFn: async () => {
      try {
        const { data } = await DashboardService.getDirectorReviewCounts()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useTransactionCounts = () => {
  return useQuery({
    queryKey: ['transaction-counts'],
    queryFn: async () => {
      try {
        const { data } = await DashboardService.getTransactionCounts()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useOrgTransactionCounts = () => {
  return useQuery({
    queryKey: ['org-transaction-counts'],
    queryFn: async () => {
      try {
        const { data } = await DashboardService.getOrgTransactionCounts()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useOrgComplianceReportCounts = () => {
  return useQuery({
    queryKey: ['org-compliance-report-counts'],
    queryFn: async () => {
      try {
        const { data } = await DashboardService.getOrgComplianceReportCounts()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}
