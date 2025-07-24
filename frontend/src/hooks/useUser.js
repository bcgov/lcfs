import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { apiRoutes } from '@/constants/routes'

export const useUsers = (options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => (await client.post('/users/')).data,
    ...options
  })
}

export const useUser = (id, options) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => (await client.get(`/users/${id}`)).data,
    enabled: !!id,
    ...options
  })
}

export const useGetUserLoginHistory = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['user-login-history', page, size, sortOrders, filters],
    queryFn: async () =>
      (
        await client.post(apiRoutes.getUserLoginHistories, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data,
    ...options
  })
}

export const useGetUserActivities = (
  { page = 1, size = 10, sortOrders = [], filters = [] } = {},
  options
) => {
  const client = useApiService()
  return useQuery({
    queryKey: ['/users/activities/all', page, size, sortOrders, filters],
    queryFn: async () =>
      (
        await client.post(apiRoutes.getAllUserActivities, {
          page,
          size,
          sortOrders,
          filters
        })
      ).data,
    ...options
  })
}

export function useDeleteUser(options = {}) {
  const apiClient = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (userID) => {
      const path = apiRoutes.deleteUser.replace(':userID', userID)
      return await apiClient.delete(path)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user', options.userID])
      queryClient.invalidateQueries(['users'])
      queryClient.invalidateQueries(['currentUser'])
    }
  })
}

export const useUpdateUser = ({
  onSuccess,
  onError,
  isSupplier = false,
  organizationId = null
} = {}) => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userID, payload }) => {
      if (isSupplier) {
        return await apiService.put(
          `/organization/${organizationId}/users/${userID}`,
          payload
        )
      }
      return await apiService.put(`/users/${userID}`, payload)
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries after successful update
      queryClient.invalidateQueries({
        queryKey: ['currentUser']
      })

      // Invalidate the specific user query
      queryClient.invalidateQueries({
        queryKey: ['user', variables.userID]
      })

      // Invalidate organization users query if in supplier context
      if (isSupplier && organizationId) {
        queryClient.invalidateQueries({
          queryKey: ['organization-users', organizationId]
        })
        queryClient.invalidateQueries({
          queryKey: ['organization-user', organizationId, variables.userID]
        })
      }

      // Invalidate users list query
      queryClient.invalidateQueries({
        queryKey: ['users']
      })

      // Invalidate available analysts list when user roles change
      queryClient.invalidateQueries({
        queryKey: ['available-analysts']
      })

      // Invalidate organization details if updating organization user
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ['organization', organizationId]
        })
      }

      // Call the provided success callback
      onSuccess?.(data, variables)
    },
    onError: (error, variables) => {
      console.error('Error updating user:', error)
      onError?.(error, variables)
    }
  })
}

export const useCreateUser = ({
  onSuccess,
  onError,
  isSupplier = false,
  organizationId = null
} = {}) => {
  const apiService = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload) => {
      if (isSupplier) {
        return await apiService.post(
          `/organization/${organizationId}/users`,
          payload
        )
      }
      return await apiService.post('/users', payload)
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries after successful creation
      queryClient.invalidateQueries({
        queryKey: ['currentUser']
      })

      // Invalidate organization users query if in supplier context
      if (isSupplier && organizationId) {
        queryClient.invalidateQueries({
          queryKey: ['organization-users', organizationId]
        })
      }

      // Invalidate users list query
      queryClient.invalidateQueries({
        queryKey: ['users']
      })

      // Invalidate available analysts list when new users are created
      queryClient.invalidateQueries({
        queryKey: ['available-analysts']
      })

      // Invalidate organization details if creating organization user
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: ['organization', organizationId]
        })
      }

      // Call the provided success callback
      onSuccess?.(data, variables)
    },
    onError: (error, variables) => {
      console.error('Error creating user:', error)
      onError?.(error, variables)
    }
  })
}
