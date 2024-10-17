import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiService } from '@/services/useApiService'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useState, useCallback } from 'react'

export const useInternalComments = (entityType, entityId) => {
  const apiService = useApiService()
  const queryClient = useQueryClient()
  const { hasAnyRole } = useCurrentUser()
  const [commentInput, setCommentInput] = useState('')

  const getAudienceScope = () => {
    if (hasAnyRole(roles.director)) {
      return 'Director'
    } else if (hasAnyRole(roles.analyst)) {
      return 'Analyst'
    } else if (hasAnyRole(roles.compliance_manager)) {
      return 'Compliance Manager'
    }
  }

  const fetchComments = async () => {
    const response = await apiService.get(
      `/internal_comments/${entityType}/${entityId}`
    )
    return response.data.sort(
      (a, b) => b.internalCommentId - a.internalCommentId
    )
  }

  const commentsQuery = useQuery({
    queryKey: ['internal-comments', entityType, entityId],
    queryFn: fetchComments,
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 60 * 60 * 1000 // 1 hour
  })

  const addCommentMutation = useMutation({
    mutationFn: async (commentText) => {
      const payload = {
        entityType,
        entityId,
        comment: commentText,
        audience_scope: getAudienceScope()
      }
      const response = await apiService.post('/internal_comments/', payload)
      return response.data
    },
    onSuccess: (newComment) => {
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId],
        (oldData) => {
          if (!oldData) return [newComment]
          const insertIndex = oldData.findIndex(
            (comment) => newComment.id > comment.id
          )
          if (insertIndex === -1) {
            return [newComment, ...oldData]
          } else {
            return [
              ...oldData.slice(0, insertIndex),
              newComment,
              ...oldData.slice(insertIndex)
            ]
          }
        }
      )
      setCommentInput('') // Clear the comment input after successful addition
    }
  })

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, commentText }) => {
      const response = await apiService.put(`/internal_comments/${commentId}`, {
        comment: commentText
      })
      return response.data
    },
    onSuccess: (updatedComment) => {
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId],
        (oldData) =>
          oldData.map((comment) =>
            comment.internalCommentId === updatedComment.internalCommentId
              ? updatedComment
              : comment
          )
      )
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

  return {
    comments: commentsQuery.data || [],
    isLoading: commentsQuery.isLoading,
    error: commentsQuery.error,
    addComment: handleAddComment,
    editComment: editCommentMutation.mutate,
    isAddingComment: addCommentMutation.isLoading,
    isEditingComment: editCommentMutation.isLoading,
    commentInput,
    handleCommentInputChange
  }
}
