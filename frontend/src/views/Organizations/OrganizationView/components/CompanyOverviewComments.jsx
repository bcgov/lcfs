import { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { Alert, Box } from '@mui/material'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import Loading from '@/components/Loading'
import BCAlert from '@/components/BCAlert'
import CommentForm from '@/components/Comments/CommentForm'
import { CommentRow } from './CommentLog/CommentRow'
import {
  useOrganizationCommentThread,
  useCreateOrganizationComment,
  useEditOrganizationComment
} from '@/hooks/useOrganizationComments'

const VISIBILITY = 'Internal'

/**
 * Company Overview thread on the Organization dashboard (#4608).
 *
 * Reuses the internal-comment framework: the create box is the shared
 * `CommentForm` WYSIWYG editor and each existing note renders through
 * `CommentRow` (author/date, last-edited info, inline edit). Comments are
 * ORGANIZATION-entity internal comments filed under the "Company Overview"
 * category, so they also surface in — and are searchable from — the org
 * Comment Log.
 *
 * Company Overview notes are always Internal: there is no public commenting on
 * this thread, so neither the create box nor the inline editor offers the
 * visibility choice.
 */
export const CompanyOverviewComments = ({
  organizationId,
  isGovernmentUser = true
}) => {
  const { t } = useTranslation(['org', 'internalComment'])
  const [commentText, setCommentText] = useState('')

  const { data, isLoading, isError } =
    useOrganizationCommentThread(organizationId)
  const createMutation = useCreateOrganizationComment(organizationId)
  const editMutation = useEditOrganizationComment(organizationId)

  const comments = data?.comments ?? []

  const handleCreate = async (text) => {
    const body = (text ?? '').trim()
    if (!body) return
    await createMutation.mutateAsync({ comment: body, visibility: VISIBILITY })
    setCommentText('')
  }

  const handleEdit = (commentId, comment) => {
    editMutation.mutate({ commentId, comment, visibility: VISIBILITY })
  }

  return (
    <BCBox
      sx={{ mt: 2, width: { md: '100%', lg: '90%' } }}
      data-test="company-overview-section"
    >
      <BCWidgetCard
        title={t('org:sections.companyOverview.title')}
        color="nav"
        content={
          <BCBox>
            <BCTypography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('org:sections.companyOverview.description')}
            </BCTypography>

            {isError && (
              <BCAlert severity="error" data-test="company-overview-error">
                {t('org:errorLoadingOrganization')}
              </BCAlert>
            )}

            {isLoading ? (
              <Loading />
            ) : comments.length === 0 ? (
              <Alert
                severity="info"
                icon={false}
                data-test="company-overview-empty"
              >
                {t('org:sections.companyOverview.empty')}
              </Alert>
            ) : (
              // Same container structure as the org Comment Log so the shared
              // CommentRow renders identically in both places (bordered white
              // panel + semantic list).
              <BCBox
                variant="bordered"
                borderRadius="sm"
                data-test="company-overview-list"
                sx={{ p: 2, backgroundColor: '#ffffff' }}
              >
                <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {comments.map((comment, index) => (
                    <Box
                      key={comment.internalCommentId}
                      component="li"
                      sx={{ listStyle: 'none' }}
                    >
                      <CommentRow
                        comment={comment}
                        index={index}
                        showInternalBadge={isGovernmentUser}
                        isGovernmentUser={isGovernmentUser}
                        allowPublicVisibility={false}
                        onEdit={handleEdit}
                        isEditPending={editMutation.isPending}
                      />
                    </Box>
                  ))}
                </Box>
              </BCBox>
            )}

            <BCBox sx={{ mt: 2 }} data-test="company-overview-add">
              <CommentForm
                title={t('org:sections.companyOverview.addTitle')}
                commentText={commentText}
                onCommentChange={setCommentText}
                onSubmit={handleCreate}
                isSubmitting={createMutation.isPending}
                showVisibilityToggle={false}
                visibility={VISIBILITY}
              />
            </BCBox>
          </BCBox>
        }
      />
    </BCBox>
  )
}

CompanyOverviewComments.propTypes = {
  organizationId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isGovernmentUser: PropTypes.bool
}

export default CompanyOverviewComments
