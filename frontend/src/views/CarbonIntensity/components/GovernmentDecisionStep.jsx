import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Avatar,
  Box,
  CircularProgress,
  Stack,
  TextField
} from '@mui/material'

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import {
  useAddCIComment,
  useGetCIComments,
  useRecordCIDecision
} from '@/hooks/useCIApplication'
import colors from '@/themes/base/colors'

const formatDateTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-CA')
}

const initials = (name) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

/**
 * Step 5 — Government decision. Renders the comments thread, an inline
 * "add comment" composer (shown to anyone with access), and — for
 * government users only — a panel to record the terminal decision.
 *
 * The wireframe specifies that supporting-document upload is conditional;
 * for now the placeholder is rendered disabled with a tooltip.
 */
export const GovernmentDecisionStep = ({
  ciApplication,
  isGovernment = false,
  readOnly = false,
  onDocumentUploadClick = null
}) => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const ciApplicationId = ciApplication?.ciApplicationId

  const { data: comments = [], isLoading } = useGetCIComments(ciApplicationId)
  const { mutateAsync: addComment, isPending: isAdding } =
    useAddCIComment(ciApplicationId)
  const { mutateAsync: recordDecision, isPending: isDeciding } =
    useRecordCIDecision(ciApplicationId)

  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleAddComment = async () => {
    setError(null)
    setSuccess(null)
    const text = draft.trim()
    if (!text) {
      setError(t('carbonIntensity:step5.commentRequired'))
      return
    }
    if (text.length > 4000) {
      setError(t('carbonIntensity:step5.commentTooLong'))
      return
    }
    try {
      await addComment(text)
      setDraft('')
      setSuccess(t('carbonIntensity:step5.commentSuccess'))
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to add comment.')
    }
  }

  const recordDecisionFor = async (status) => {
    setError(null)
    setSuccess(null)
    try {
      await recordDecision({ status, comment: draft.trim() || null })
      setDraft('')
      setSuccess(t('carbonIntensity:step5.decisionSuccess'))
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to record decision.'
      )
    }
  }

  return (
    <Box>
      <BCTypography variant="h6" sx={{ pb: 2, color: colors.primary.main }}>
        {t('carbonIntensity:step5.title')}
      </BCTypography>

      <BCTypography variant="body2" sx={{ mb: 1 }}>
        {t('carbonIntensity:step5.intro')}
      </BCTypography>
      <BCTypography variant="body2" sx={{ mb: 3, fontWeight: 600 }}>
        {t('carbonIntensity:step5.responseExpectations')}
      </BCTypography>

      <BCTypography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        {t('carbonIntensity:step5.commentsHeader')}
      </BCTypography>

      <BCBox
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
          mb: 2,
          maxHeight: 320,
          overflowY: 'auto'
        }}
        data-test="ci-step5-thread"
      >
        {isLoading ? (
          <CircularProgress size={20} />
        ) : comments.length === 0 ? (
          <BCTypography variant="body2" color="text.secondary">
            {t('carbonIntensity:step5.noComments')}
          </BCTypography>
        ) : (
          comments.map((c) => (
            <Box
              key={c.commentId}
              data-test="ci-step5-comment"
              sx={{ display: 'flex', gap: 1.5, mb: 2 }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: 14,
                  bgcolor: c.isGovernment ? 'primary.main' : 'secondary.main'
                }}
              >
                {initials(c.authorDisplayName || c.authorUsername)}
              </Avatar>
              <Box>
                <BCTypography variant="body2" sx={{ fontWeight: 600 }}>
                  {c.authorDisplayName || c.authorUsername || '(unknown)'}
                  {', '}
                  <BCTypography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                  >
                    {formatDateTime(c.createDate)}
                  </BCTypography>
                </BCTypography>
                <BCTypography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap' }}
                  data-test="ci-step5-comment-text"
                >
                  {c.text}
                </BCTypography>
              </Box>
            </Box>
          ))
        )}
      </BCBox>

      {error && (
        <BCAlert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </BCAlert>
      )}
      {success && (
        <BCAlert
          severity="success"
          sx={{ mb: 1 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </BCAlert>
      )}

      <BCTypography variant="body2" sx={{ mb: 1 }}>
        {t('carbonIntensity:step5.addCommentLabel')}
      </BCTypography>
      <TextField
        multiline
        rows={3}
        fullWidth
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={readOnly}
        inputProps={{
          'data-test': 'ci-step5-comment-input',
          maxLength: 4001
        }}
        sx={{ mb: 1 }}
      />

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <BCButton
          type="button"
          variant="outlined"
          color="primary"
          onClick={handleAddComment}
          disabled={readOnly || isAdding}
          data-test="ci-step5-add-comment-btn"
        >
          {t('carbonIntensity:step5.addComment')}
        </BCButton>
      </Stack>

      <Box sx={{ mb: 3 }}>
        <BCTypography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          {t('carbonIntensity:step5.uploadEnabled')}
        </BCTypography>
        <BCTypography variant="caption" color="text.secondary">
          {t('carbonIntensity:step5.uploadDisabledHelp')}
        </BCTypography>
        <Box sx={{ mt: 1 }}>
          <BCButton
            type="button"
            variant="contained"
            color="primary"
            disabled={!onDocumentUploadClick || readOnly}
            onClick={onDocumentUploadClick || undefined}
            data-test="ci-step5-upload-btn"
          >
            {t('carbonIntensity:step5.uploadEnabled')}
          </BCButton>
        </Box>
      </Box>

      {isGovernment && (
        <Role roles={[roles.government, roles.analyst, roles.director]}>
          <Box
            sx={{
              borderTop: 1,
              borderColor: 'divider',
              pt: 2
            }}
            data-test="ci-step5-decision-panel"
          >
            <BCTypography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              {t('carbonIntensity:step5.decisionHeader')}
            </BCTypography>
            <Stack direction="row" spacing={2}>
              <BCButton
                type="button"
                variant="contained"
                color="primary"
                disabled={readOnly || isDeciding}
                onClick={() => recordDecisionFor('Completed')}
                data-test="ci-step5-complete-btn"
              >
                {t('carbonIntensity:step5.completeBtn')}
              </BCButton>
              <BCButton
                type="button"
                variant="outlined"
                color="error"
                disabled={readOnly || isDeciding}
                onClick={() => recordDecisionFor('Withdrawn')}
                data-test="ci-step5-withdraw-btn"
              >
                {t('carbonIntensity:step5.withdrawBtn')}
              </BCButton>
            </Stack>
          </Box>
        </Role>
      )}
    </Box>
  )
}

GovernmentDecisionStep.displayName = 'GovernmentDecisionStep'
