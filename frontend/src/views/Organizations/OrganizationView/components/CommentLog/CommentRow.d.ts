import type { ForwardRefExoticComponent, RefAttributes } from 'react'
import type {
  CommentLogVisibility,
  OrganizationCommentRecord
} from '@/hooks/useOrganizationComments'
import type { MentionableUser } from '@/hooks/useMentionableUsers'

export interface CommentRowProps {
  comment: OrganizationCommentRecord
  index: number
  showInternalBadge?: boolean
  isGovernmentUser?: boolean
  showOrganizationName?: boolean
  allowPublicVisibility?: boolean
  useLatestAttribution?: boolean
  searchQuery?: string
  onEdit?: (
    commentId: number,
    comment: string,
    visibility: CommentLogVisibility
  ) => void
  isEditPending?: boolean
  enableMentions?: boolean
  mentionResults?: { data?: MentionableUser[]; isFetching?: boolean }
  onMentionQueryChange?: (query: string | null) => void
}

export const CommentRow: ForwardRefExoticComponent<
  CommentRowProps & RefAttributes<HTMLElement>
>
