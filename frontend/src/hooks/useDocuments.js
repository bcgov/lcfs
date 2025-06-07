import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Default cache configuration
const DEFAULT_STALE_TIME = 10 * 60 * 1000 // 10 minutes
const DEFAULT_CACHE_TIME = 15 * 60 * 1000 // 15 minutes
const DOCUMENT_STALE_TIME = 10 * 60 * 1000 // 10 minutes (documents don't change frequently)

export const useDocuments = (parentType, parentID, options = {}) => {
  const client = useApiService()

  const {
    staleTime = DOCUMENT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['documents', parentType, parentID],
    queryFn: async () => {
      if (!parentID || !parentType) {
        throw new Error('Parent ID and Parent Type are required')
      }

      const path = apiRoutes.getDocuments
        .replace(':parentID', parentID)
        .replace(':parentType', parentType)

      const response = await client.get(path)
      return response.data
    },
    enabled: enabled && !!parentID && !!parentType,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useUploadDocument = (parentType, parentID, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    onUploadProgress,
    invalidateRelatedQueries = true,
    clearCache = false,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (file) => {
      if (!file) {
        throw new Error('File is required for upload')
      }
      if (!parentID || !parentType) {
        throw new Error('Parent ID and Parent Type are required')
      }

      const path = apiRoutes.getDocuments
        .replace(':parentID', parentID)
        .replace(':parentType', parentType)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)

      return await client.post(path, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: onUploadProgress
      })
    },
    onSuccess: (data, variables, context) => {
      if (clearCache) {
        queryClient.removeQueries(['documents', parentType, parentID])
      } else {
        queryClient.invalidateQueries(['documents', parentType, parentID])
      }

      if (invalidateRelatedQueries) {
        // Invalidate any parent entity that might display document counts or status
        if (parentType === 'compliance_report') {
          queryClient.invalidateQueries(['compliance-report', parentID])
          queryClient.invalidateQueries(['compliance-report-summary', parentID])
        }
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useDeleteDocument = (parentType, parentID, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async (documentID) => {
      if (!documentID) {
        throw new Error('Document ID is required for deletion')
      }
      if (!parentID || !parentType) {
        throw new Error('Parent ID and Parent Type are required')
      }

      const path = apiRoutes.getDocument
        .replace(':parentID', parentID)
        .replace(':parentType', parentType)
        .replace(':documentID', documentID)

      return await client.delete(path)
    },
    onSuccess: (data, variables, context) => {
      // Always invalidate after deletion to ensure removed document is gone from cache
      queryClient.invalidateQueries(['documents', parentType, parentID])

      if (invalidateRelatedQueries) {
        if (parentType === 'compliance_report') {
          queryClient.invalidateQueries(['compliance-report', parentID])
          queryClient.invalidateQueries(['compliance-report-summary', parentID])
        }
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}

export const useDownloadDocument = (parentType, parentID, options = {}) => {
  const client = useApiService()

  const { onSuccess, onError, ...requestOptions } = options

  return async (documentID, customFilename) => {
    try {
      if (!documentID) {
        throw new Error('Document ID is required for download')
      }
      if (!parentID || !parentType) {
        throw new Error('Parent ID and Parent Type are required')
      }

      const path = apiRoutes.getDocument
        .replace(':parentID', parentID)
        .replace(':parentType', parentType)
        .replace(':documentID', documentID)

      const response = await client.get(path, {
        ...requestOptions,
        responseType: 'blob'
      })

      // Create a URL for the document data
      const fileURL = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = fileURL

      // Extract filename from headers or use custom filename
      let filename = customFilename
      if (!filename) {
        const contentDisposition = response.headers['content-disposition'] || ''
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        )
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
          filename = decodeURIComponent(filename)
        } else {
          filename = `document_${documentID}`
        }
      }

      link.download = filename

      // Append to the body, trigger click, then remove
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the object URL after a short delay
      setTimeout(() => URL.revokeObjectURL(fileURL), 100)

      onSuccess?.(response.data, filename)
      return response.data
    } catch (error) {
      onError?.(error)
      throw error
    }
  }
}

export const useGetDocumentInfo = (
  parentType,
  parentID,
  documentID,
  options = {}
) => {
  const client = useApiService()

  const {
    staleTime = DOCUMENT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    ...restOptions
  } = options

  return useQuery({
    queryKey: ['document-info', parentType, parentID, documentID],
    queryFn: async () => {
      if (!documentID || !parentID || !parentType) {
        throw new Error('Document ID, Parent ID, and Parent Type are required')
      }

      const path = apiRoutes.getDocument
        .replace(':parentID', parentID)
        .replace(':parentType', parentType)
        .replace(':documentID', documentID)

      const response = await client.get(path)
      return response.data
    },
    enabled: enabled && !!documentID && !!parentID && !!parentType,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })
}

export const useUpdateDocument = (parentType, parentID, options = {}) => {
  const client = useApiService()
  const queryClient = useQueryClient()

  const {
    onSuccess,
    onError,
    invalidateRelatedQueries = true,
    clearCache = false,
    ...restOptions
  } = options

  return useMutation({
    mutationFn: async ({ documentID, data }) => {
      if (!documentID) {
        throw new Error('Document ID is required for update')
      }
      if (!parentID || !parentType) {
        throw new Error('Parent ID and Parent Type are required')
      }

      const path = apiRoutes.getDocument
        .replace(':parentID', parentID)
        .replace(':parentType', parentType)
        .replace(':documentID', documentID)

      return await client.put(path, data)
    },
    onSuccess: (data, variables, context) => {
      const { documentID } = variables

      if (clearCache) {
        queryClient.removeQueries(['documents', parentType, parentID])
        queryClient.removeQueries([
          'document-info',
          parentType,
          parentID,
          documentID
        ])
      } else {
        queryClient.invalidateQueries(['documents', parentType, parentID])
        queryClient.invalidateQueries([
          'document-info',
          parentType,
          parentID,
          documentID
        ])
      }

      if (invalidateRelatedQueries) {
        if (parentType === 'compliance_report') {
          queryClient.invalidateQueries(['compliance-report', parentID])
          queryClient.invalidateQueries(['compliance-report-summary', parentID])
        }
      }

      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context)
    },
    ...restOptions
  })
}
