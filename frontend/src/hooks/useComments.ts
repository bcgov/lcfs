import type { QueryOptions } from './types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'

interface CommentRecord extends Record<string, unknown> {
  internalCommentId: number
  comment: string
  isOptimistic?: boolean
}
interface CommentAttachment {
  documentId: number
}
interface AttachmentChanges {
  uploaded: Map<File, number>
  removed: Set<number | string>
}
interface CommentOptions extends QueryOptions<CommentRecord[]> {
  autoFetch?: boolean
  optimisticUpdates?: boolean
  sortOrder?: 'asc' | 'desc'
  commentMode?: 'internal-only' | 'dual'
}
interface EditComment {
  commentId: number | string
  commentText: string
  visibility?: string
  newFiles?: File[]
  removedDocumentIds?: (number | string)[]
}

const createAttachmentChanges = (): AttachmentChanges => ({
  uploaded: new Map(),
  removed: new Set()
})

const DEFAULT_STALE_TIME = 5 * 60 * 1000
const DEFAULT_CACHE_TIME = 15 * 60 * 1000

export const useComments = (
  entityType: string,
  entityId: number | string,
  options: CommentOptions = {}
) => {
  const apiService = useApiService()
  const queryClient = useQueryClient()
  const { hasAnyRole } = useCurrentUser()
  const [commentInput, setCommentInput] = useState('')
  // Files staged in the "add comment" form. They can only be uploaded once the
  // comment exists (and has an id), so they are held here until submit.
  const [attachments, setAttachments] = useState<File[]>([])
  const [mutationError, setMutationError] = useState<Error | null>(null)
  // Keep the saved comment when an upload fails, so retrying the draft does
  // not create a second comment or re-upload files that already succeeded.
  const pendingCreation = useRef<{
    entityType: string
    entityId: number | string
    comment: CommentRecord
    attachmentChanges: AttachmentChanges
  } | null>(null)
  const editAttachments = useRef(new Map<number | string, AttachmentChanges>())

  // Attachments live on the comment via parent_type "internal_comment" in the
  // shared document API; upload one staged file against a known comment id.
  const uploadAttachment = useCallback(
    async (commentId: number | string, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)
      const response = await apiService.post<CommentAttachment>(
        `/documents/internal_comment/${commentId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return response.data
    },
    [apiService]
  )

  const saveAttachmentChanges = useCallback(
    async (
      commentId: number | string,
      files: File[],
      removedDocumentIds: (number | string)[],
      changes: AttachmentChanges
    ) => {
      // Upload replacements first so a failed upload keeps the old documents.
      for (const file of files) {
        if (changes.uploaded.has(file)) continue
        const document = await uploadAttachment(commentId, file)
        changes.uploaded.set(file, document.documentId)
      }

      // A user can remove a staged file after an earlier upload partly
      // succeeded. Reconcile that choice with the saved document on retry.
      const selectedFiles = new Set(files)
      const discardedUploads = [...changes.uploaded].filter(
        ([file]) => !selectedFiles.has(file)
      )
      const removedIds = new Set([
        ...removedDocumentIds,
        ...discardedUploads.map(([, documentId]) => documentId)
      ])
      for (const documentId of removedIds) {
        if (changes.removed.has(documentId)) continue
        await apiService.delete(
          `/documents/internal_comment/${commentId}/${documentId}`
        )
        changes.removed.add(documentId)
      }
      for (const [file] of discardedUploads) changes.uploaded.delete(file)
    },
    [apiService, uploadAttachment]
  )

  const cancelEditComment = useCallback((commentId: number | string) => {
    editAttachments.current.delete(commentId)
  }, [])

  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_CACHE_TIME,
    enabled = true,
    autoFetch = true,
    optimisticUpdates = true,
    sortOrder: initialSortOrder = 'desc',
    commentMode = 'internal-only',
    ...restOptions
  } = options

  const [sortOrder, setSortOrder] = useState(initialSortOrder)

  const handleSortOrderChange = useCallback((newSortOrder: 'asc' | 'desc') => {
    setSortOrder(newSortOrder)
  }, [])

  const isGov = useMemo(
    () =>
      hasAnyRole(
        roles.government,
        roles.director,
        roles.analyst,
        roles.compliance_manager
      ),
    [hasAnyRole]
  )
  const hasInternalAudienceScopeRole = useMemo(
    () =>
      isGov ||
      hasAnyRole(roles.director, roles.analyst, roles.compliance_manager),
    [hasAnyRole, isGov]
  )

  const isDualMode = commentMode === 'dual'

  // Visibility state for dual mode (gov users can toggle, BCeID forced to Public)
  const [visibility, setVisibility] = useState(
    isDualMode && !isGov ? 'Public' : 'Internal'
  )

  useEffect(() => {
    if (isDualMode && !isGov && visibility === 'Internal') {
      setVisibility('Public')
    }
  }, [isDualMode, isGov, visibility])

  const handleVisibilityChange = useCallback(
    (newVisibility: string) => {
      // BCeID users cannot switch to Internal
      if (!isGov && newVisibility === 'Internal') return
      setVisibility(newVisibility)
    },
    [isGov]
  )

  // Memoize audience scope
  const audienceScope = useMemo(() => {
    // In dual mode, BCeID users don't have audience scope
    if (isDualMode && !isGov) {
      return null
    }
    // Public comments don't need audience scope
    if (isDualMode && visibility === 'Public') {
      return null
    }
    // Standard gov audience scope logic
    if (hasAnyRole(roles.director)) {
      return 'Director'
    } else if (hasAnyRole(roles.analyst)) {
      return 'Analyst'
    } else if (hasAnyRole(roles.compliance_manager)) {
      return 'Compliance Manager'
    } else if (isGov) {
      // Fallback for government users without delegated assessment roles.
      return 'Analyst'
    }
    return null
  }, [hasAnyRole, isDualMode, isGov, visibility])

  const fetchComments = useCallback(async () => {
    if (!entityId || !entityType) {
      throw new Error('Entity ID and Entity Type are required')
    }

    const response = await apiService.get(
      `/internal_comments/${entityType}/${entityId}`
    )

    return response.data
  }, [apiService, entityType, entityId])

  const invalidateCommentQueries = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['internal-comments', entityType, entityId]
    })
    queryClient.invalidateQueries({
      queryKey: ['organization-comments'],
      predicate: ({ queryKey }) =>
        entityType !== 'penaltyLog' || String(queryKey[1]) === String(entityId)
    })
  }, [queryClient, entityType, entityId])

  const commentsQuery = useQuery({
    queryKey: ['internal-comments', entityType, entityId],
    queryFn: fetchComments,
    enabled: enabled && autoFetch && !!entityId && !!entityType,
    staleTime,
    gcTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })

  const addCommentMutation = useMutation({
    mutationFn: async (
      variables: string | { commentText: string; files?: File[] }
    ) => {
      // Callers may pass a bare comment string (legacy) or
      // { commentText, files } so staged attachments are uploaded after the
      // comment is created and has an id.
      const { commentText, files } =
        typeof variables === 'string'
          ? { commentText: variables, files: [] as File[] }
          : {
              commentText: variables?.commentText,
              files: variables?.files || []
            }

      if (!commentText?.trim()) {
        throw new Error('Comment text is required')
      }
      if (!entityId || !entityType) {
        throw new Error('Entity ID and Entity Type are required')
      }

      const payload = {
        entityType,
        entityId,
        comment: commentText.trim(),
        audience_scope: audienceScope,
        visibility: isDualMode ? visibility : 'Internal'
      }

      let pending = pendingCreation.current
      if (
        pending?.entityType !== entityType ||
        pending?.entityId !== entityId
      ) {
        pending = null
      }
      if (!pending) {
        const response = await apiService.post('/internal_comments/', payload)
        pending = {
          entityType,
          entityId,
          comment: response.data,
          attachmentChanges: createAttachmentChanges()
        }
        pendingCreation.current = pending
      } else {
        const response = await apiService.put(
          `/internal_comments/${pending.comment.internalCommentId}`,
          payload
        )
        pending.comment = response.data
      }
      const createdComment = pending.comment
      const commentId = createdComment?.internalCommentId

      if (commentId) {
        await saveAttachmentChanges(
          commentId,
          files,
          [],
          pending.attachmentChanges
        )
      }

      pendingCreation.current = null
      return createdComment
    },
    onMutate: async (variables) => {
      setMutationError(null)
      if (!optimisticUpdates) return

      const commentText =
        typeof variables === 'string' ? variables : variables?.commentText || ''

      await queryClient.cancelQueries({
        queryKey: ['internal-comments', entityType, entityId]
      })

      const previousComments = queryClient.getQueryData([
        'internal-comments',
        entityType,
        entityId
      ]) as CommentRecord[] | undefined

      if (previousComments) {
        const optimisticComment = {
          internalCommentId: Date.now(),
          comment: commentText.trim(),
          audience_scope: audienceScope,
          visibility: isDualMode ? visibility : 'Internal',
          documents: [],
          createDate: new Date().toISOString(),
          isOptimistic: true
        }

        const newComments =
          sortOrder === 'desc'
            ? [optimisticComment, ...previousComments]
            : [...previousComments, optimisticComment]

        queryClient.setQueryData(
          ['internal-comments', entityType, entityId],
          newComments
        )
      }

      return { previousComments }
    },
    onError: (_err, _commentText, context) => {
      setMutationError(_err)
      if (context?.previousComments && optimisticUpdates) {
        queryClient.setQueryData(
          ['internal-comments', entityType, entityId],
          context.previousComments
        )
      }
    },
    onSuccess: (newComment) => {
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId],
        (oldData: CommentRecord[] | undefined) => {
          if (!oldData) return [newComment]

          const realComments = oldData.filter(
            (comment: CommentRecord) => !comment.isOptimistic
          )

          if (sortOrder === 'desc') {
            const insertIndex = realComments.findIndex(
              (comment: CommentRecord) =>
                newComment.internalCommentId > comment.internalCommentId
            )
            if (insertIndex === -1) {
              return [newComment, ...realComments]
            } else {
              return [
                ...realComments.slice(0, insertIndex),
                newComment,
                ...realComments.slice(insertIndex)
              ]
            }
          } else {
            const insertIndex = realComments.findIndex(
              (comment: CommentRecord) =>
                newComment.internalCommentId < comment.internalCommentId
            )
            if (insertIndex === -1) {
              return [...realComments, newComment]
            } else {
              return [
                ...realComments.slice(0, insertIndex),
                newComment,
                ...realComments.slice(insertIndex)
              ]
            }
          }
        }
      )

      setCommentInput('')
      setAttachments([])
      // Reset visibility to Internal after submitting (gov users in dual mode only)
      if (isDualMode && isGov) {
        setVisibility('Internal')
      }
    },
    onSettled: invalidateCommentQueries
  })

  const editCommentMutation = useMutation({
    mutationFn: async ({
      commentId,
      commentText,
      visibility: editVisibility,
      newFiles = [],
      removedDocumentIds = []
    }: EditComment) => {
      if (!commentId) {
        throw new Error('Comment ID is required for editing')
      }
      if (!commentText?.trim()) {
        throw new Error('Comment text is required')
      }

      const payload: Record<string, unknown> = {
        comment: commentText.trim()
      }
      if (typeof editVisibility === 'string') {
        payload.visibility = editVisibility
      }

      const response = await apiService.put(
        `/internal_comments/${commentId}`,
        payload
      )

      const progress =
        editAttachments.current.get(commentId) ?? createAttachmentChanges()
      editAttachments.current.set(commentId, progress)
      await saveAttachmentChanges(
        commentId,
        newFiles,
        removedDocumentIds,
        progress
      )
      editAttachments.current.delete(commentId)

      return response.data
    },
    onMutate: async ({
      commentId,
      commentText,
      visibility: editVisibility
    }) => {
      setMutationError(null)
      if (!optimisticUpdates) return

      await queryClient.cancelQueries({
        queryKey: ['internal-comments', entityType, entityId]
      })

      const previousComments = queryClient.getQueryData([
        'internal-comments',
        entityType,
        entityId
      ]) as CommentRecord[] | undefined

      if (previousComments) {
        const updatedComments = previousComments.map(
          (comment: CommentRecord) =>
            comment.internalCommentId === commentId
              ? {
                  ...comment,
                  comment: commentText.trim(),
                  ...(typeof editVisibility === 'string'
                    ? { visibility: editVisibility }
                    : {}),
                  isOptimistic: true
                }
              : comment
        )

        queryClient.setQueryData(
          ['internal-comments', entityType, entityId],
          updatedComments
        )
      }

      return { previousComments }
    },
    onError: (_err, _variables, context) => {
      setMutationError(_err)
      if (context?.previousComments && optimisticUpdates) {
        queryClient.setQueryData(
          ['internal-comments', entityType, entityId],
          context.previousComments
        )
      }
    },
    onSuccess: (updatedComment) => {
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId],
        (oldData: CommentRecord[] | undefined) =>
          oldData?.map((comment: CommentRecord) =>
            comment.internalCommentId === updatedComment.internalCommentId
              ? { ...updatedComment, isOptimistic: false }
              : comment
          ) || []
      )
    },
    onSettled: invalidateCommentQueries
  })

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number | string) => {
      if (!commentId) {
        throw new Error('Comment ID is required for deletion')
      }

      const response = await apiService.delete(
        `/internal_comments/${commentId}`
      )
      return { commentId, response: response.data }
    },
    onMutate: async (commentId: number | string) => {
      setMutationError(null)
      if (!optimisticUpdates) return

      await queryClient.cancelQueries({
        queryKey: ['internal-comments', entityType, entityId]
      })

      const previousComments = queryClient.getQueryData([
        'internal-comments',
        entityType,
        entityId
      ]) as CommentRecord[] | undefined

      if (previousComments) {
        const filteredComments = previousComments.filter(
          (comment: CommentRecord) => comment.internalCommentId !== commentId
        )

        queryClient.setQueryData(
          ['internal-comments', entityType, entityId],
          filteredComments
        )
      }

      return { previousComments }
    },
    onError: (_err, _commentId, context) => {
      setMutationError(_err)
      if (context?.previousComments && optimisticUpdates) {
        queryClient.setQueryData(
          ['internal-comments', entityType, entityId],
          context.previousComments
        )
      }
    },
    onSuccess: ({ commentId }) => {
      editAttachments.current.delete(commentId)
      if (pendingCreation.current?.comment.internalCommentId === commentId) {
        pendingCreation.current = null
      }
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId],
        (oldData: CommentRecord[] | undefined) =>
          oldData?.filter(
            (comment: CommentRecord) => comment.internalCommentId !== commentId
          ) || []
      )
    },
    onSettled: invalidateCommentQueries
  })

  const handleCommentInputChange = useCallback((value: string) => {
    setCommentInput(value)
  }, [])

  const handleAttachmentsChange = useCallback((files: File[]) => {
    setAttachments(files)
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  const handleAddComment = useCallback(async () => {
    if (commentInput.trim()) {
      return await addCommentMutation.mutateAsync({
        commentText: commentInput,
        files: attachments
      })
    }
  }, [commentInput, attachments, addCommentMutation])

  const handleEditComment = useCallback(
    ({
      commentId,
      commentText,
      visibility: editVisibility,
      newFiles = [],
      removedDocumentIds = []
    }: EditComment) => {
      return editCommentMutation.mutateAsync({
        commentId,
        commentText,
        visibility: editVisibility,
        newFiles,
        removedDocumentIds
      })
    },
    [editCommentMutation]
  )

  // Download an attachment that belongs to a saved comment.
  const downloadCommentAttachment = useCallback(
    async (
      commentId: number | string,
      documentId: unknown,
      filename?: string
    ) => {
      const response = await apiService.get(
        `/documents/internal_comment/${commentId}/${documentId}`,
        { responseType: 'blob' }
      )
      const fileURL = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = fileURL
      link.download = filename || `document_${documentId}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(fileURL), 100)
    },
    [apiService]
  )

  const handleDeleteComment = useCallback(
    (commentId: number | string) => {
      return deleteCommentMutation.mutateAsync(commentId)
    },
    [deleteCommentMutation]
  )

  const refreshComments = useCallback(() => {
    return commentsQuery.refetch()
  }, [commentsQuery])

  const clearCommentInput = useCallback(() => {
    setCommentInput('')
  }, [])

  const canComment = useMemo(() => {
    if (isDualMode) {
      // Both gov and BCeID can comment in dual mode
      return !!entityId && !!entityType
    }
    // Original behavior: require audience scope (gov role)
    return !!audienceScope && !!entityId && !!entityType
  }, [audienceScope, entityId, entityType, isDualMode])

  const sortedComments = useMemo(() => {
    const comments = commentsQuery.data || []
    return [...comments].sort((a: CommentRecord, b: CommentRecord) => {
      const dateA = Date.parse(String(a.createDate ?? ''))
      const dateB = Date.parse(String(b.createDate ?? ''))
      const difference =
        Number.isFinite(dateA) && Number.isFinite(dateB) ? dateA - dateB : 0
      const comparison = difference || a.internalCommentId - b.internalCommentId
      return sortOrder === 'desc' ? -comparison : comparison
    })
  }, [commentsQuery.data, sortOrder])

  return {
    // Data
    comments: sortedComments,
    audienceScope,
    commentInput,
    attachments,
    visibility,
    allowInternalVisibility: hasInternalAudienceScopeRole,

    // Loading states
    isLoading: commentsQuery.isLoading,
    isPending: commentsQuery.isPending,
    isRefetching: commentsQuery.isRefetching,
    isAddingComment: addCommentMutation.isPending,
    isEditingComment: editCommentMutation.isPending,
    isDeletingComment: deleteCommentMutation.isPending,

    // Error states
    error: commentsQuery.error,
    mutationError,
    addError: addCommentMutation.error,
    editError: editCommentMutation.error,
    deleteError: deleteCommentMutation.error,

    // Actions
    addComment: handleAddComment,
    editComment: handleEditComment,
    cancelEditComment,
    deleteComment: handleDeleteComment,
    refreshComments,

    // Input management
    handleCommentInputChange,
    clearCommentInput,

    // Attachment management
    handleAttachmentsChange,
    clearAttachments,
    downloadCommentAttachment,

    // Visibility management (dual mode)
    handleVisibilityChange,

    // Sort order management
    sortOrder,
    handleSortOrderChange,

    // Utilities
    canComment,

    // Query utilities
    invalidateComments: () =>
      queryClient.invalidateQueries({
        queryKey: ['internal-comments', entityType, entityId]
      }),
    prefetchComments: () =>
      queryClient.prefetchQuery({
        queryKey: ['internal-comments', entityType, entityId],
        queryFn: fetchComments,
        staleTime,
        gcTime
      })
  }
}
