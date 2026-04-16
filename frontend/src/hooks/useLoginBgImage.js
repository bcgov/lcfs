import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const QUERY_KEY = 'login-bg-images'

export const useLoginBgImages = (options = {}) => {
  const client = useApiService()
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const response = await client.get(apiRoutes.loginBgImages)
      return response.data
    },
    ...options
  })
}

export const useActiveLoginBgImage = (options = {}) => {
  const client = useApiService()
  return useQuery({
    queryKey: [QUERY_KEY, 'active'],
    queryFn: async () => {
      const response = await client.get(apiRoutes.loginBgImageActive)
      return response.data
    },
    ...options
  })
}

export const useUploadLoginBgImage = (options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options

  return useMutation({
    mutationFn: async ({ file, displayName, caption }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('display_name', displayName)
      if (caption) formData.append('caption', caption)
      const response = await client.post(apiRoutes.loginBgImages, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QUERY_KEY])
      onSuccess?.(data, variables, context)
    },
    onError,
    ...rest
  })
}

export const useUpdateLoginBgImage = (options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options

  return useMutation({
    mutationFn: async ({ imageId, displayName, caption }) => {
      const path = apiRoutes.loginBgImage.replace(':imageId', imageId)
      const response = await client.put(path, { display_name: displayName, caption })
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QUERY_KEY])
      onSuccess?.(data, variables, context)
    },
    onError,
    ...rest
  })
}

export const useActivateLoginBgImage = (options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options

  return useMutation({
    mutationFn: async (imageId) => {
      const path = apiRoutes.loginBgImageActivate.replace(':imageId', imageId)
      const response = await client.put(path)
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QUERY_KEY])
      onSuccess?.(data, variables, context)
    },
    onError,
    ...rest
  })
}

export const useDeleteLoginBgImage = (options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options

  return useMutation({
    mutationFn: async (imageId) => {
      const path = apiRoutes.loginBgImage.replace(':imageId', imageId)
      return await client.delete(path)
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QUERY_KEY])
      onSuccess?.(data, variables, context)
    },
    onError,
    ...rest
  })
}
