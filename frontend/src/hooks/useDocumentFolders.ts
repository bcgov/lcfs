import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'

// Folder layer for the Initiative Agreements module (#4925). The tree,
// its mutations and placements are keyed together so any change refreshes
// the whole view in one round trip.

const treeKey = (parentType: string, parentID: number | string) => [
  'document-tree',
  parentType,
  String(parentID)
]

const fillPath = (
  template: string,
  parentType: string,
  parentID: number | string
) =>
  template
    .replace(':parentType', parentType)
    .replace(':parentID', String(parentID))

export const useDocumentTree = (
  parentType: string,
  parentID: number | string,
  options: Record<string, unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!parentID,
    queryKey: treeKey(parentType, parentID),
    queryFn: async () =>
      (
        await client.get(
          fillPath(apiRoutes.documentFolderTree, parentType, parentID)
        )
      ).data,
    ...options
  })
}

const useInvalidateTree = (parentType: string, parentID: number | string) => {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: treeKey(parentType, parentID) })
}

export const useCreateFolder = (
  parentType: string,
  parentID: number | string
) => {
  const client = useApiService()
  const invalidate = useInvalidateTree(parentType, parentID)
  return useMutation({
    mutationFn: async ({
      name,
      parentFolderId
    }: {
      name: string
      parentFolderId?: number | null
    }) =>
      (
        await client.post(
          fillPath(apiRoutes.documentFolderTree, parentType, parentID),
          { name, parentFolderId: parentFolderId ?? null }
        )
      ).data,
    onSuccess: invalidate
  })
}

export const useUpdateFolder = (
  parentType: string,
  parentID: number | string
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const key = treeKey(parentType, parentID)
  return useMutation({
    mutationFn: async ({
      folderId,
      ...payload
    }: {
      folderId: number
      name?: string
      parentFolderId?: number
      moveToRoot?: boolean
      sortOrder?: number
    }) =>
      (
        await client.put(
          fillPath(
            apiRoutes.documentFolderUpdate,
            parentType,
            parentID
          ).replace(':folderId', String(folderId)),
          payload
        )
      ).data,
    // A drag that visibly waits on a round trip reads as broken, so
    // folder moves apply optimistically and roll back on error.
    onMutate: async (variables) => {
      if (variables.parentFolderId === undefined && !variables.moveToRoot) {
        return {}
      }
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      if (previous) {
        const { applyFolderMove } = await import(
          '@/views/InitiativeAgreements/components/documentTreeDnd'
        )
        queryClient.setQueryData(
          key,
          applyFolderMove(
            previous,
            variables.folderId,
            variables.moveToRoot ? null : variables.parentFolderId
          )
        )
      }
      return { previous }
    },
    onError: (_error, _variables, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key })
  })
}

export const useDeleteFolder = (
  parentType: string,
  parentID: number | string
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateTree(parentType, parentID)
  return useMutation({
    mutationFn: async ({
      folderId,
      strategy = 'reparent'
    }: {
      folderId: number
      strategy?: 'reparent' | 'cascade'
    }) =>
      client.delete(
        `${fillPath(
          apiRoutes.documentFolderUpdate,
          parentType,
          parentID
        ).replace(':folderId', String(folderId))}?strategy=${strategy}`
      ),
    onSuccess: () => {
      invalidate()
      // A cascade lands the folder in the bin, so the bin must refetch
      // too or the row appears only on the next page load.
      queryClient.invalidateQueries({
        queryKey: deletedKey(parentType, parentID)
      })
    }
  })
}

export const useMoveDocuments = (
  parentType: string,
  parentID: number | string
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const key = treeKey(parentType, parentID)
  return useMutation({
    mutationFn: async ({
      documentIds,
      folderId
    }: {
      documentIds: number[]
      folderId: number | null
    }) =>
      client.put(
        fillPath(apiRoutes.documentFolderItems, parentType, parentID),
        { documentIds, folderId }
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      if (previous) {
        const { applyDocumentMove } = await import(
          '@/views/InitiativeAgreements/components/documentTreeDnd'
        )
        queryClient.setQueryData(
          key,
          applyDocumentMove(previous, variables.documentIds, variables.folderId)
        )
      }
      return { previous }
    },
    onError: (_error, _variables, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key })
  })
}

/**
 * Upload files straight into a folder: the shared upload route first, then
 * one placement call — the design's two-call pattern, so the upload path
 * itself stays untouched. A failure between the calls leaves the file at
 * the root: visible and fixable by dragging.
 */
export const useFolderUpload = (
  parentType: string,
  parentID: number | string
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  const key = treeKey(parentType, parentID)
  return useMutation({
    mutationFn: async ({
      files,
      folderId
    }: {
      files: File[]
      folderId: number | null
    }) => {
      const uploadPath = apiRoutes.getDocuments
        .replace(':parentType', parentType)
        .replace(':parentID', String(parentID))
      const documentIds: number[] = []

      // File whatever made it into the target folder before re-raising.
      // Uploads happen one at a time, so a rejection partway through a
      // batch would otherwise strand its predecessors at the tree root,
      // where nobody dropped them.
      const fileIntoFolder = async () => {
        if (folderId !== null && documentIds.length) {
          await client.put(
            fillPath(apiRoutes.documentFolderItems, parentType, parentID),
            { documentIds, folderId }
          )
        }
      }

      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('filename', file.name)
        try {
          const response = await client.post(uploadPath, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
          documentIds.push(response.data.documentId)
        } catch (error: any) {
          await fileIntoFolder()
          // Name the file: "that file type is not allowed" is no help
          // when five were dropped at once.
          const detail =
            error?.response?.data?.detail || error?.message || 'Upload failed'
          const failure: any = new Error(`${file.name}: ${detail}`)
          failure.uploadedCount = documentIds.length
          throw failure
        }
      }

      await fileIntoFolder()
      return documentIds
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key })
  })
}

// The bin (#deleted items). Nothing ever leaves it, so the endpoint is
// paginated from the start even though the panel does not page yet.
const deletedKey = (parentType: string, parentID: number | string) => [
  'document-tree-deleted',
  parentType,
  String(parentID)
]

export const useDeletedDocuments = (
  parentType: string,
  parentID: number | string,
  options: Record<string, unknown> = {}
) => {
  const client = useApiService()
  return useQuery({
    enabled: !!parentID,
    queryKey: deletedKey(parentType, parentID),
    queryFn: async () =>
      (
        await client.get(
          fillPath(apiRoutes.documentFolderDeleted, parentType, parentID)
        )
      ).data,
    ...options
  })
}

const useBinMutation = (
  parentType: string,
  parentID: number | string,
  run: (client: any) => (documentId: number) => Promise<unknown>
) => {
  const client = useApiService()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run(client),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeKey(parentType, parentID) })
      queryClient.invalidateQueries({
        queryKey: deletedKey(parentType, parentID)
      })
    }
  })
}

export const useSoftDeleteDocument = (
  parentType: string,
  parentID: number | string
) =>
  useBinMutation(
    parentType,
    parentID,
    (client) => async (documentId: number) =>
      client.delete(
        fillPath(
          apiRoutes.documentFolderDeleteDocument,
          parentType,
          parentID
        ).replace(':documentId', String(documentId))
      )
  )

export const useRestoreDocument = (
  parentType: string,
  parentID: number | string
) =>
  useBinMutation(
    parentType,
    parentID,
    (client) => async (documentId: number) =>
      client.put(
        fillPath(
          apiRoutes.documentFolderRestoreDocument,
          parentType,
          parentID
        ).replace(':documentId', String(documentId))
      )
  )

/** Bring a folder back, with what was inside it and the path it needs. */
export const useRestoreFolder = (
  parentType: string,
  parentID: number | string
) =>
  useBinMutation(
    parentType,
    parentID,
    (client) => async (folderId: number) =>
      client.put(
        fillPath(
          apiRoutes.documentFolderRestoreFolder,
          parentType,
          parentID
        ).replace(':folderId', String(folderId))
      )
  )
