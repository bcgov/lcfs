import { PaginationRequestSchema, UsersService } from '@/services/apiClient'
import { useQuery } from '@tanstack/react-query'

export const useUser = ({ id }: { id: number }) => {
  return useQuery({
    enabled: !!id,
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
    }
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
