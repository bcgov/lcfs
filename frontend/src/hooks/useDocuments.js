import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useDocuments = (parentType, parentID, options) => {
  const client = useApiService()

  return useQuery({
    queryKey: ['documents', parentType, parentID],
    queryFn: async () => {
      const path = apiRoutes.getDocuments
        .replace(':parentID', parentID)
        .replace(':parentType', parentType)

      const res = await client.get(path)
      return res.data
    },
    enabled: !!parentID,
    ...options
  })
}

export const useUploadDocument = (parentType, parentID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const path = apiRoutes.getDocuments
    .replace(':parentID', parentID)
    .replace(':parentType', parentType)

  return useMutation({
    ...options,
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)

      return await client.post(path, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', parentType, parentID])
    }
  })
}

export const useDeleteDocument = (parentType, parentID, options) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  return useMutation({
    ...options,
    mutationFn: async (documentID) => {
      const path = apiRoutes.getDocument
        .replace(':parentID', parentID)
        .replace(':parentType', parentType)
        .replace(':documentID', documentID)
      return await client.delete(path)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['documents', parentType, parentID])
    }
  })
}

export const useViewDocument = (parentType, parentID, options) => {
  const client = useApiService()

  return async (documentID) => {
    if (!documentID) return null // Early return if no documentID

    const path = apiRoutes.getDocument
      .replace(':parentID', parentID)
      .replace(':parentType', parentType)
      .replace(':documentID', documentID)

    const res = await client.get(path, {
      ...options,
      responseType: 'blob'
    })

    // Create a URL for the document data
    const fileURL = URL.createObjectURL(res.data)
    window.open(fileURL, '_blank')

    // Revoke the object URL after opening
    setTimeout(() => URL.revokeObjectURL(fileURL), 100)

    return res.data
  }
}
