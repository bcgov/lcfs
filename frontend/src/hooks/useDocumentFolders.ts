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
  const invalidate = useInvalidateTree(parentType, parentID)
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
    onSuccess: invalidate
  })
}

export const useDeleteFolder = (
  parentType: string,
  parentID: number | string
) => {
  const client = useApiService()
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
    onSuccess: invalidate
  })
}

export const useMoveDocuments = (
  parentType: string,
  parentID: number | string
) => {
  const client = useApiService()
  const invalidate = useInvalidateTree(parentType, parentID)
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
    onSuccess: invalidate
  })
}
