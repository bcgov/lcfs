import { RolesService } from '@/services/apiClient'
import { useQuery } from '@tanstack/react-query'

export const useRoleList = ({
  governmentRolesOnly
}: {
  governmentRolesOnly: boolean
}) => {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      try {
        const { data } = await RolesService.getRoles({
          query: {
            government_roles_only: governmentRolesOnly
          }
        })
        console.log(data)
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}
