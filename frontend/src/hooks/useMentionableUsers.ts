import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'

export interface MentionableUser {
  userProfileId: number
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  displayName: string
}

/** IDIR users matching `query` for the comment @mention lookup. */
export const useMentionableUsers = (query: string, enabled: boolean) => {
  const apiService = useApiService()

  return useQuery<MentionableUser[]>({
    queryKey: ['mentionable-users', query],
    queryFn: async () => {
      const response = await apiService.get(
        `/internal_comments/mentionable-users?q=${encodeURIComponent(query)}`
      )
      return response.data
    },
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData
  })
}
