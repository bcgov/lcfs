import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import DeleteOutline from '@mui/icons-material/DeleteOutline'

import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { Role } from '@/components/Role'
import { useRemoveDesignatedAction } from '@/hooks/useInitiativeAgreements'
import { ROUTES, buildPath } from '@/routes/routes'
import { packageEditorRoles } from './packageEditors'

/**
 * Remove a designated action in a change order (#5555). The organization
 * keeps seeing it until the Director accepts the change order. Shown only
 * inside a change order, and not for an action already being removed or
 * one with credits issued, which the API refuses.
 */
export const RemoveDesignatedAction = ({ action }) => {
  if (
    action.changeOrderNumber == null ||
    action.changeOrderState === 'removed' ||
    action.transactionId != null
  ) {
    return null
  }
  return <RemoveDesignatedActionControl action={action} />
}

const RemoveDesignatedActionControl = ({ action }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  // BCModal stays busy after its primary action; remount it after a failure.
  const [attempt, setAttempt] = useState(0)
  const { mutate: removeAction, isPending } = useRemoveDesignatedAction(
    action.initiativeAgreementId,
    action.designatedActionId
  )

  const number = action.changeOrderNumber

  const remove = () =>
    removeAction(undefined, {
      onSuccess: () => {
        setOpen(false)
        navigate(
          buildPath(ROUTES.INITIATIVE_AGREEMENTS.VIEW, {
            initiativeAgreementId: action.initiativeAgreementId
          })
        )
      },
      onError: (err) => {
        setError(
          err?.response?.data?.detail ||
            err?.message ||
            t('initiativeAgreement:changeOrder.removeActionFailed')
        )
        setAttempt((previous) => previous + 1)
      }
    })

  return (
    <Role roles={packageEditorRoles(true)}>
      {/* Styled like the card header's Edit button it sits beside. */}
      <BCButton
        type="button"
        variant="outlined"
        color="light"
        size="small"
        startIcon={<DeleteOutline sx={{ width: '16px', height: '16px' }} />}
        style={{ maxHeight: '25px', minHeight: '25px' }}
        sx={{
          borderColor: 'rgba(255, 255, 255, 1)',
          color: 'rgba(255, 255, 255, 1)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            color: 'rgba(0, 0, 0, 0.9)',
            borderColor: 'rgba(0, 0, 0, 0.8)'
          }
        }}
        data-test="remove-designated-action"
        onClick={() => {
          setError('')
          setOpen(true)
        }}
      >
        {t('initiativeAgreement:changeOrder.removeAction')}
      </BCButton>
      <BCModal
        key={attempt}
        open={open}
        onClose={() => setOpen(false)}
        data={{
          title: t('initiativeAgreement:changeOrder.removeActionTitle'),
          primaryButtonText: t('initiativeAgreement:changeOrder.removeAction'),
          primaryButtonColor: 'error',
          primaryButtonAction: remove,
          primaryButtonDisabled: isPending,
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {error && (
                <BCTypography
                  variant="body4"
                  color="error"
                  data-test="remove-action-error"
                >
                  {error}
                </BCTypography>
              )}
              <BCTypography variant="body4" component="p">
                {t('initiativeAgreement:changeOrder.removeActionBody', {
                  number
                })}
              </BCTypography>
            </Box>
          )
        }}
      />
    </Role>
  )
}

export default RemoveDesignatedAction
