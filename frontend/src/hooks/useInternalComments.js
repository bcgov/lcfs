import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useState, useCallback, useMemo } from 'react'

// Default cache configuration
const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes
const DEFAULT_CACHE_TIME = 15 * 60 * 1000 // 15 minutes (longer for comments)

export const useInternalComments = (entityType, entityId, options = {}) => {
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
    sortOrder = 'desc', // 'desc' for newest first, 'asc' for oldest first
    ...restOptions
  } = options

  // Memoize audience scope to prevent unnecessary recalculations
  const audienceScope = useMemo(() => {
    if (hasAnyRole(roles.director)) {
      return 'Director'
    } else if (hasAnyRole(roles.analyst)) {
      return 'Analyst'
    } else if (hasAnyRole(roles.compliance_manager)) {
      return 'Compliance Manager'
    }
    return null
  }, [hasAnyRole])

  // Memoize fetch function
  const fetchComments = useCallback(async () => {
    if (!entityId || !entityType) {
      throw new Error('Entity ID and Entity Type are required')
    }

    const response = await apiService.get(
      `/internal_comments/${entityType}/${entityId}`
    )

    // Sort comments based on sortOrder preference
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
      if (!audienceScope) {
        throw new Error('User role not authorized for comments')
      }

      const payload = {
        entityType,
        entityId,
        comment: commentText.trim(),
        audience_scope: audienceScope
      }

      const response = await apiService.post('/internal_comments/', payload)
      return response.data
    },
    onMutate: async (commentText) => {
      if (!optimisticUpdates) return

      // Cancel any outgoing refetches
      await queryClient.cancelQueries([
        'internal-comments',
        entityType,
        entityId
      ])

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData([
        'internal-comments',
        entityType,
        entityId,
        { sortOrder }
      ])

      // Optimistically update to the new value
      if (previousComments) {
        const optimisticComment = {
          internalCommentId: Date.now(), // Temporary ID
          comment: commentText.trim(),
          audience_scope: audienceScope,
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

      // Return a context object with the snapshotted value
      return { previousComments }
    },
    onError: (_err, commentText, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousComments && optimisticUpdates) {
        queryClient.setQueryData(
          ['internal-comments', entityType, entityId, { sortOrder }],
          context.previousComments
        )
      }
    },
    onSuccess: (newComment) => {
      // Remove optimistic comment and add real comment
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId, { sortOrder }],
        (oldData) => {
          if (!oldData) return [newComment]

          // Remove any optimistic comments
          const realComments = oldData.filter(
            (comment) => !comment.isOptimistic
          )

          // Insert new comment in correct position based on sort order
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

      setCommentInput('') // Clear the comment input after successful addition
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have latest data
      queryClient.invalidateQueries(['internal-comments', entityType, entityId])
    }
  })

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, commentText }) => {
      if (!commentId) {
        throw new Error('Comment ID is required for editing')
      }
      if (!commentText?.trim()) {
        throw new Error('Comment text is required')
      }

      const response = await apiService.put(`/internal_comments/${commentId}`, {
        comment: commentText.trim()
      })
      return response.data
    },
    onMutate: async ({ commentId, commentText }) => {
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

      // Optimistically update the comment
      if (previousComments) {
        const updatedComments = previousComments.map((comment) =>
          comment.internalCommentId === commentId
            ? { ...comment, comment: commentText.trim(), isOptimistic: true }
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

      // Optimistically remove the comment
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
      // Ensure the comment is removed from cache
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

  // Memoized handlers to prevent unnecessary re-renders
  const handleCommentInputChange = useCallback((value) => {
    setCommentInput(value)
  }, [])

  const handleAddComment = useCallback(async () => {
    if (commentInput.trim()) {
      await addCommentMutation.mutateAsync(commentInput)
    }
  }, [commentInput, addCommentMutation])

  const handleEditComment = useCallback(
    (commentId, commentText) => {
      return editCommentMutation.mutateAsync({ commentId, commentText })
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

  // Utility functions
  const clearCommentInput = useCallback(() => {
    setCommentInput('')
  }, [])

  const canComment = useMemo(() => {
    return !!audienceScope && !!entityId && !!entityType
  }, [audienceScope, entityId, entityType])

  return {
    // Data
    comments: commentsQuery.data || [],
    audienceScope,
    commentInput,

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
