import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  AudienceScopeEnum,
  EntityTypeEnum,
  InternalCommentResponseSchema,
  InternalCommentsService
} from '@/services/apiClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

export const useInternalComments = ({
  entityType,
  entityId
}: {
  entityType: EntityTypeEnum
  entityId: number
}) => {
  const queryClient = useQueryClient()
  const { hasAnyRole } = useCurrentUser()
  const [commentInput, setCommentInput] = useState('')

  const getAudienceScope: () => AudienceScopeEnum = () => {
    if (hasAnyRole(roles.director)) {
      return 'Director'
    } else if (hasAnyRole(roles.analyst)) {
      return 'Analyst'
    } else {
      return 'Compliance Manager'
    }
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['internal-comments', entityType, entityId],
    queryFn: async () => {
      try {
        const { data } = await InternalCommentsService.getComments({
          path: { entity_id: entityId, entity_type: entityType }
        })
        return data
      } catch (error) {
        console.log(error)
      }
    },
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  const { mutateAsync: addComment, isPending: isAddCommentPending } =
    useMutation({
      mutationFn: async (commentText: string) => {
        try {
          const payload = {
            entityType,
            entityId,
            comment: commentText,
            audienceScope: getAudienceScope()
          }
          const { data } = await InternalCommentsService.createComment({
            body: payload
          })
          return data
        } catch (error) {
          console.log(error)
        }
      },
      onSuccess: (newComment) => {
        if (!newComment) return
        queryClient.setQueryData(
          ['internal-comments', entityType, entityId],
          (oldData: InternalCommentResponseSchema[]) => {
            if (!oldData) return [newComment]
            const insertIndex = oldData.findIndex(
              (comment) =>
                newComment.internalCommentId > comment.internalCommentId
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

  const { mutate: editComment, isPending: isEditCommentPending } = useMutation({
    // mutationFn: async ({ commentId, commentText }) => {
    //   const response = await apiService.put(`/internal_comments/${commentId}`, {
    //     comment: commentText
    //   })
    //   return response.data
    // },
    mutationFn: async ({
      commentId,
      commentText
    }: {
      commentId: number
      commentText: string
    }) => {
      try {
        const { data } = await InternalCommentsService.updateComment({
          path: { internal_comment_id: commentId },
          body: { comment: commentText }
        })

        return data
      } catch (error) {
        console.log(error)
      }
    },
    onSuccess: (updatedComment) => {
      if (!updatedComment) return
      queryClient.setQueryData(
        ['internal-comments', entityType, entityId],
        (oldData: InternalCommentResponseSchema[]) =>
          oldData.map((comment) =>
            comment.internalCommentId === updatedComment.internalCommentId
              ? updatedComment
              : comment
          )
      )
    }
  })

  const handleCommentInputChange = useCallback((value: string) => {
    setCommentInput(value)
  }, [])

  const handleAddComment = useCallback(async () => {
    if (commentInput.trim()) {
      await addComment(commentInput)
    }
  }, [commentInput, addComment])

  return {
    comments:
      data?.sort((a, b) => b.internalCommentId - a.internalCommentId) || [],
    isLoading,
    error,
    addComment: handleAddComment,
    editComment,
    isAddingComment: isAddCommentPending,
    isEditingComment: isEditCommentPending,
    commentInput,
    handleCommentInputChange
  }
}
