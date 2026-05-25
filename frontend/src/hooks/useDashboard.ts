import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'
import type { QueryOptions } from './types'

export const useDirectorReviewCounts = (options: QueryOptions<unknown> = {}) => {
  const client = useApiService()
  const path = apiRoutes.directorReviewCounts

  return useQuery({
    queryKey: ['director-review-counts'],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    },
    ...options
  })
}

export const useTransactionCounts = (options: QueryOptions<unknown> = {}) => {
  const client = useApiService()
  const path = apiRoutes.TransactionCounts

  return useQuery({
    queryKey: ['transaction-counts'],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    },
    ...options
  })
}

export const useOrgTransactionCounts = (options: QueryOptions<unknown> = {}) => {
  const client = useApiService()
  const path = apiRoutes.OrgTransactionCounts

  return useQuery({
    queryKey: ['org-transaction-counts'],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    },
    ...options
  })
}

export const useOrgComplianceReportCounts = (options: QueryOptions<unknown> = {}) => {
  const client = useApiService()
  const path = apiRoutes.OrgComplianceReportCounts

  return useQuery({
    queryKey: ['org-compliance-report-counts'],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    },
    ...options
  })
}

export const useComplianceReportCounts = () => {
  const client = useApiService()
  const path = apiRoutes.complianceReportCounts

  return useQuery({
    queryKey: ['compliance-report-counts'],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    }
  })
}
export const useFuelCodeCounts = () => {
  const client = useApiService()
  const path = apiRoutes.fuelCodeCounts

  return useQuery({
    queryKey: ['fuel-code-counts'],
    queryFn: async () => {
      const response = await client.get(path)
      return response.data
    }
  })
}
