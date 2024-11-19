import {
  PaginationRequestSchema,
  UserBaseSchema,
  UsersService
} from '@/services/apiClient'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'

export const useUser = (
  { id }: { id: number },
  options?: Omit<
    UseQueryOptions<UserBaseSchema | undefined>,
    'queryKey' | 'queryFn'
  >
) => {
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      try {
        const { data } = await UsersService.getUserById({
          path: { user_id: id }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    },
    ...options
  })
}

export const useGetUserLoginHistory = (
  params: PaginationRequestSchema = {}
) => {
  return useQuery({
    queryKey: ['user-login-history', params],
    queryFn: async () => {
      try {
        const { data } = await UsersService.getAllUserLoginHistory({
          body: params
        })

        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}
