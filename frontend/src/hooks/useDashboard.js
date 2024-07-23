import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useQuery } from '@tanstack/react-query'

export const useDirectorReviewCounts = (options = {}) => {
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