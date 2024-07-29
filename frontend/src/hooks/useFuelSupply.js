import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'

export const useGetFuelSupplies = (complianceReportId, pagination, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['fuel-supplies', complianceReportId, pagination],
    queryFn: async () => {
      const response = await client.post(apiRoutes.getAllFuelSupplies, { complianceReportId, ...pagination })
      return response.data
    },
    ...options
  })
}
