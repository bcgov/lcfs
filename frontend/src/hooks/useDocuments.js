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

export const useDownloadDocument = (parentType, parentID, options) => {
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
    const link = document.createElement('a')
    link.href = fileURL

    // Extract filename from headers and set on link
    const contentDisposition = res.headers['content-disposition'] || ''
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
    link.download = decodeURIComponent(filenameMatch[1])

    // Append to the body, trigger click, then remove
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => URL.revokeObjectURL(fileURL), 100)
    return res.data
  }
}
