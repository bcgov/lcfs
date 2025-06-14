import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from './useCurrentUser'
import { roles } from '@/constants/roles'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 10 * 60 * 1000 // 10 minutes
const BALANCE_STALE_TIME = 2 * 60 * 1000 // 2 minutes (more frequent updates for financial data)
const USER_DATA_STALE_TIME = 10 * 60 * 1000 // 10 minutes (user data changes less frequently)

export const useOrganization = (orgID, options = {}) => {
  const client = useApiService()
  const { data: currentUser } = useCurrentUser()
  const id = orgID ?? currentUser?.organization?.organizationId

  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['organization', id],
    queryFn: async () => {
      if (!id) {
        throw new Error('Organization ID is required')
      }
      const response = await client.get(`/organizations/${id}`)
      return response.data
    },
    enabled: enabled && !!id,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useOrganizationUser = (orgID, userID, options = {}) => {
  const client = useApiService()

  const {
    staleTime = USER_DATA_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['organization-user', orgID, userID],
    queryFn: async () => {
      if (!orgID || !userID) {
        throw new Error('Organization ID and User ID are required')
      }
      const response = await client.get(
        `/organization/${orgID}/users/${userID}`
      )
      return response.data
    },
    enabled: enabled && !!orgID && !!userID,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useOrganizationBalance = (orgID, options = {}) => {
  const client = useApiService()
  const { hasRoles } = useCurrentUser()
  const hasAccess = hasRoles(roles.government)

  const {
    staleTime = BALANCE_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['organization-balance', orgID],
    queryFn: async () => {
      if (!hasAccess) {
        return null
      }
      if (!orgID) {
        return {}
      }
      const response = await client.get(`/organizations/balances/${orgID}`)
      return response.data
    },
    enabled: enabled && hasAccess && !!orgID,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useCurrentOrgBalance = (options = {}) => {
  const client = useApiService()

  const {
    staleTime = BALANCE_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['current-org-balance'],
    queryFn: async () => {
      const response = await client.get(`/organizations/current/balances`)
      return response.data
    },
    enabled,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useGetOrgComplianceReportReportedYears = (orgID, options = {}) => {
  const client = useApiService()
  const { data: currentUser } = useCurrentUser()
  const id = orgID ?? currentUser?.organization?.organizationId

  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['org-compliance-reports', id],
    queryFn: async () => {
      if (!id) {
        throw new Error('Organization ID is required')
      }
      const path = apiRoutes.getOrgComplianceReportReportedYears.replace(
        ':orgID',
        id
      )
      const response = await client.get(path)
      return response.data
    },
    enabled: enabled && !!id,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

// Mutation hooks for updating organization data
export const useUpdateOrganization = (orgID, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    clearCache = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (data) => {
      if (!orgID) {
        throw new Error('Organization ID is required')
      }
      return await client.put(`/organizations/${orgID}`, data)
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        queryClient.removeQueries(['organization', orgID])
      } else {
        queryClient.setQueryData(['organization', orgID], data.data)
      }

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries(['organization'])
        queryClient.invalidateQueries(['current-org-balance'])
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries(['organization', orgID])
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useUpdateOrganizationUser = (orgID, userID, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    clearCache = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (data) => {
      if (!orgID || !userID) {
        throw new Error('Organization ID and User ID are required')
      }
      return await client.put(`/organization/${orgID}/users/${userID}`, data)
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        queryClient.removeQueries(['organization-user', orgID, userID])
      } else {
        queryClient.setQueryData(
          ['organization-user', orgID, userID],
          data.data
        )
      }

      if (invalidateRelatedQueries) {
        queryClient.invalidateQueries(['organization-user'])
        queryClient.invalidateQueries(['organization', orgID])
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries(['organization-user', orgID, userID])
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}
