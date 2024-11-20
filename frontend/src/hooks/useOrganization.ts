import { OrganizationService, OrganizationsService } from '@/services/apiClient'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'

export const useOrganization = ({ orgId }: { orgId: number }) => {
  const { data: currentUser } = useCurrentUser()
  const id = orgId ?? currentUser?.organization?.organizationId

  return useQuery({
    enabled: !!id,
    queryKey: ['organization', id],
    queryFn: async () => {
      try {
        const { data } = await OrganizationsService.getOrganization({
          path: { organization_id: id }
        })

        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useOrganizationUser = ({
  orgId,
  userId
}: {
  orgId: number
  userId: number
}) => {
  return useQuery({
    queryKey: ['organization-user'],
    queryFn: async () => {
      try {
        const { data } = await OrganizationService.getOrgUserById({
          path: {
            organization_id: orgId,
            user_id: userId
          }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useOrganizationBalance = ({ orgId }: { orgId: number }) => {
  return useQuery({
    queryKey: ['organization-balance', orgId],
    queryFn: async () => {
      try {
        const { data } = await OrganizationsService.getBalancesByOrgId({
          path: { organization_id: orgId }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}
export const useCurrentOrgBalance = () => {
  return useQuery({
    queryKey: ['current-org-balance'],
    queryFn: async () => {
      try {
        const { data } = await OrganizationsService.getBalances()
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useGetOrgComplianceReportReportedYears = () => {
  const { data: currentUser } = useCurrentUser()
  const id = currentUser?.organization?.organizationId
  return useQuery({
    enabled: !!id,
    queryKey: ['org-compliance-reports', id],
    queryFn: async () => {
      try {
        const { data } = await OrganizationService.getAllOrgReportedYears({
          path: { organization_id: id! }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}
