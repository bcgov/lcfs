import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Stack } from '@mui/material'

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Comments from '@/components/Comments'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { useRecordCIDecision } from '@/hooks/useCIApplication'
import colors from '@/themes/base/colors'

/**
 * Step 5 — Government decision. Renders the shared comments widget
 * (entityType="ciApplication", commentMode="dual" — gov posts Internal
 * or Public, BCeID posts Public-only) plus, for government users, a
 * panel to record the terminal decision.
 */
export const GovernmentDecisionStep = ({
  ciApplication,
  isGovernment = false,
  readOnly = false,
  onDocumentUploadClick = null
}) => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const ciApplicationId = ciApplication?.ciApplicationId

  const { mutateAsync: recordDecision, isPending: isDeciding } =
    useRecordCIDecision(ciApplicationId)

  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const recordDecisionFor = async (status) => {
    setError(null)
    setSuccess(null)
    try {
      await recordDecision({ status })
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

      <Box sx={{ mb: 2 }} data-test="ci-step5-comments">
        {ciApplicationId ? (
          <Comments
            entityType="ciApplication"
            entityId={ciApplicationId}
            commentMode="dual"
          />
        ) : (
          <BCTypography variant="body2" color="text.secondary">
            {t('carbonIntensity:step5.noComments')}
          </BCTypography>
        )}
      </Box>

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
