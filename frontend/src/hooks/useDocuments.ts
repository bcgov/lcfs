import { DocumentsService } from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export const useDocuments = ({
  parentType,
  parentId
}: {
  parentType: string
  parentId: number
}) => {
  return useQuery({
    queryKey: ['documents', parentType, parentId],
    queryFn: async () => {
      try {
        const { data } = await DocumentsService.getAllDocuments({
          path: { parent_id: parentId, parent_type: parentType }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}

export const useUploadDocument = ({
  parentType,
  parentId
}: {
  parentType: string
  parentId: number
}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      try {
        const body = {
          file,
          fileName: file.name
        }

        await DocumentsService.uploadFile({
          path: { parent_id: parentId, parent_type: parentType },
          body
        })
      } catch (error) {
        console.log(error)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['documents', parentType, parentId]
      })
    }
  })
}

export const useDeleteDocument = ({
  parentType,
  parentId
}: {
  parentType: string
  parentId: number
}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (documentId: number) => {
      try {
        await DocumentsService.deleteFile({
          path: {
            document_id: documentId,
            parent_id: parentId,
            parent_type: parentType
          }
        })
      } catch (error) {
        console.log(error)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['documents', parentType, parentId]
      })
    }
  })
}

export const useViewDocument = ({
  parentType,
  parentId,
  documentId
}: {
  parentType: string
  parentId: number
  documentId: number
}) => {
  return useQuery({
    queryKey: ['view-document', parentId, parentType],
    queryFn: async () => {
      try {
        const { data } = await DocumentsService.streamDocument({
          path: {
            document_id: documentId,
            parent_id: parentId,
            parent_type: parentType
          }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    }
  })
}
