import { OrganizationsService } from '@/services/apiClient'
import { useQuery } from '@tanstack/react-query'

export const useOrganizationStatuses = () => {
  return useQuery({
    queryKey: ['organization-statuses'],
    queryFn: async () => {
      try {
        const { data } = await OrganizationsService.getOrganizationStatuses()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useOrganizationNames = () => {
  return useQuery({
    queryKey: ['organization-names'],
    queryFn: async () => {
      try {
        const { data } = await OrganizationsService.getOrganizationNames()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useRegExtOrgs = () => {
  return useQuery({
    queryKey: ['registered-external-orgs'],
    queryFn: async () => {
      const { data } =
        await OrganizationsService.getExternallyRegisteredOrganizations()
      return data
    },
    initialData: []
  })
}
