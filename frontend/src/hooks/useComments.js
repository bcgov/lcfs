import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useState, useCallback, useMemo, useEffect } from 'react'

const DEFAULT_STALE_TIME = 5 * 60 * 1000
const DEFAULT_CACHE_TIME = 15 * 60 * 1000

export const useComments = (entityType, entityId, options = {}) => {
  const apiService = useApiService()
  const queryClient = useQueryClient()
  const { hasAnyRole } = useCurrentUser()
  const [commentInput, setCommentInput] = useState('')

  const {
    staleTime = DEFAULT_STALE_TIME,
    cacheTime = DEFAULT_CACHE_TIME,
    enabled = true,
    autoFetch = true,
    optimisticUpdates = true,
    sortOrder = 'desc',
    commentMode = 'internal-only',
    ...restOptions
  } = options

  const isGov = useMemo(
    () => hasAnyRole(roles.government),
    [hasAnyRole]
  )
  const hasInternalAudienceScopeRole = useMemo(
    () => isGov || hasAnyRole(roles.director, roles.analyst, roles.compliance_manager),
    [hasAnyRole, isGov]
  )

  const isDualMode = commentMode === 'dual'

  // Visibility state for dual mode (gov users can toggle, BCeID forced to Public)
  const [visibility, setVisibility] = useState(
    isDualMode && !isGov
      ? 'Public'
      : 'Internal'
  )

  useEffect(() => {
    if (isDualMode && !isGov && visibility === 'Internal') {
      setVisibility('Public')
    }
  }, [isDualMode, isGov, visibility])

  const handleVisibilityChange = useCallback((newVisibility) => {
    // BCeID users cannot switch to Internal
    if (!isGov && newVisibility === 'Internal') return
    setVisibility(newVisibility)
  }, [isGov])

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

    const sortedComments = response.data.sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.internalCommentId - a.internalCommentId
      } else {
        return a.internalCommentId - b.internalCommentId
      }
    })

    return sortedComments
  }, [apiService, entityType, entityId, sortOrder])

  const commentsQuery = useQuery({
    queryKey: ['internal-comments', entityType, entityId, { sortOrder }],
    queryFn: fetchComments,
    enabled: enabled && autoFetch && !!entityId && !!entityType,
    staleTime,
    cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...restOptions
  })

  const addCommentMutation = useMutation({
    mutationFn: async (commentText) => {
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

      const response = await apiService.post('/internal_comments/', payload)
      return response.data
    },
    onMutate: async (commentText) => {
      if (!optimisticUpdates) return

      await queryClient.cancelQueries([
        'internal-comments',
        entityType,
        entityId
      ])

      const previousComments = queryClient.getQueryData([
        'internal-comments',
        entityType,
        entityId,
        { sortOrder }
      ])

      if (previousComments) {
        const optimisticComment = {
          internalCommentId: Date.now(),
          comment: commentText.trim(),
          audience_scope: audienceScope,
          visibility: isDualMode ? visibility : 'Internal',
          createdAt: new Date().toISOString(),
          isOptimistic: true
        }

        const newComments =
          sortOrder === 'desc'
            ? [optimisticComment, ...previousComments]
            : [...previousComments, optimisticComment]

        queryClient.setQueryData(
          ['internal-comments', entityType, entityId, { sortOrder }],
          newComments
        )
      }

      return { previousComments }
    },
    onError: (_err, commentText, context) => {
      if (context?.previousComments && optimisticUpdates) {
        queryClient.setQueryData(
          ['internal-comments', entityType, entityId, { sortOrder }],
          context.previousComments
        )
      }
    },
    onSuccess: (newComment) => {
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId, { sortOrder }],
        (oldData) => {
          if (!oldData) return [newComment]

          const realComments = oldData.filter(
            (comment) => !comment.isOptimistic
          )

          if (sortOrder === 'desc') {
            const insertIndex = realComments.findIndex(
              (comment) =>
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
              (comment) =>
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
    },
    onSettled: () => {
      queryClient.invalidateQueries(['internal-comments', entityType, entityId])
    }
  })

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, commentText, visibility: editVisibility }) => {
      if (!commentId) {
        throw new Error('Comment ID is required for editing')
      }
      if (!commentText?.trim()) {
        throw new Error('Comment text is required')
      }

      const payload = {
        comment: commentText.trim()
      }
      if (typeof editVisibility === 'string') {
        payload.visibility = editVisibility
        payload.audience_scope =
          editVisibility === 'Public' ? null : audienceScope
      }

      const response = await apiService.put(
        `/internal_comments/${commentId}`,
        payload
      )
      return response.data
    },
    onMutate: async ({ commentId, commentText, visibility: editVisibility }) => {
      if (!optimisticUpdates) return

      await queryClient.cancelQueries([
        'internal-comments',
        entityType,
        entityId
      ])

      const previousComments = queryClient.getQueryData([
        'internal-comments',
        entityType,
        entityId,
        { sortOrder }
      ])

      if (previousComments) {
        const updatedComments = previousComments.map((comment) =>
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
          ['internal-comments', entityType, entityId, { sortOrder }],
          updatedComments
        )
      }

      return { previousComments }
    },
    onError: (_err, variables, context) => {
      if (context?.previousComments && optimisticUpdates) {
        queryClient.setQueryData(
          ['internal-comments', entityType, entityId, { sortOrder }],
          context.previousComments
        )
      }
    },
    onSuccess: (updatedComment) => {
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId, { sortOrder }],
        (oldData) =>
          oldData?.map((comment) =>
            comment.internalCommentId === updatedComment.internalCommentId
              ? { ...updatedComment, isOptimistic: false }
              : comment
          ) || []
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries(['internal-comments', entityType, entityId])
    }
  })

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      if (!commentId) {
        throw new Error('Comment ID is required for deletion')
      }

      const response = await apiService.delete(
        `/internal_comments/${commentId}`
      )
      return { commentId, response: response.data }
    },
    onMutate: async (commentId) => {
      if (!optimisticUpdates) return

      await queryClient.cancelQueries([
        'internal-comments',
        entityType,
        entityId
      ])

      const previousComments = queryClient.getQueryData([
        'internal-comments',
        entityType,
        entityId,
        { sortOrder }
      ])

      if (previousComments) {
        const filteredComments = previousComments.filter(
          (comment) => comment.internalCommentId !== commentId
        )

        queryClient.setQueryData(
          ['internal-comments', entityType, entityId, { sortOrder }],
          filteredComments
        )
      }

      return { previousComments }
    },
    onError: (_err, commentId, context) => {
      if (context?.previousComments && optimisticUpdates) {
        queryClient.setQueryData(
          ['internal-comments', entityType, entityId, { sortOrder }],
          context.previousComments
        )
      }
    },
    onSuccess: ({ commentId }) => {
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId, { sortOrder }],
        (oldData) =>
          oldData?.filter(
            (comment) => comment.internalCommentId !== commentId
          ) || []
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries(['internal-comments', entityType, entityId])
    }
  })

  const handleCommentInputChange = useCallback((value) => {
    setCommentInput(value)
  }, [])

  const handleAddComment = useCallback(async () => {
    if (commentInput.trim()) {
      await addCommentMutation.mutateAsync(commentInput)
    }
  }, [commentInput, addCommentMutation])

  const handleEditComment = useCallback(
    ({ commentId, commentText, visibility: editVisibility }) => {
      return editCommentMutation.mutateAsync({
        commentId,
        commentText,
        visibility: editVisibility
      })
    },
    [editCommentMutation]
  )

  const handleDeleteComment = useCallback(
    (commentId) => {
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

  return {
    // Data
    comments: commentsQuery.data || [],
    audienceScope,
    commentInput,
    visibility,
    allowInternalVisibility: hasInternalAudienceScopeRole,

    // Loading states
    isLoading: commentsQuery.isLoading,
    isRefetching: commentsQuery.isRefetching,
    isAddingComment: addCommentMutation.isPending,
    isEditingComment: editCommentMutation.isPending,
    isDeletingComment: deleteCommentMutation.isPending,

    // Error states
    error: commentsQuery.error,
    addError: addCommentMutation.error,
    editError: editCommentMutation.error,
    deleteError: deleteCommentMutation.error,

    // Actions
    addComment: handleAddComment,
    editComment: handleEditComment,
    deleteComment: handleDeleteComment,
    refreshComments,

    // Input management
    handleCommentInputChange,
    clearCommentInput,

    // Visibility management (dual mode)
    handleVisibilityChange,

    // Utilities
    canComment,

    // Query utilities
    invalidateComments: () =>
      queryClient.invalidateQueries([
        'internal-comments',
        entityType,
        entityId
      ]),
    prefetchComments: () =>
      queryClient.prefetchQuery({
        queryKey: ['internal-comments', entityType, entityId, { sortOrder }],
        queryFn: fetchComments,
        staleTime,
        cacheTime
      })
  }
}

