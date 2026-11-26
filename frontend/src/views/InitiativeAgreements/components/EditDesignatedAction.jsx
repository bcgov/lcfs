import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'

import { FloatingAlert } from '@/components/BCAlert'
import { WidgetEditButton } from '@/components/BCWidgetCard/WidgetEditButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import ModalField from './ModalField'
import { Role } from '@/components/Role'
import { packageEditorRoles } from './packageEditors'
import { useUpdateDesignatedAction } from '@/hooks/useInitiativeAgreements'

// Correcting a designated action while the agreement's package is open to
// edits (#5554); the detail page leaves it out once the package is
// read-only. In a change order draft the Director may edit too, and the
// change waits for acceptance (#5555). Every change is recorded in the
// activity trail with its before and after.
export const EditDesignatedAction = ({
  action,
  onChanged,
  inChangeOrder = false
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [credits, setCredits] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [error, setError] = useState('')
  const alertRef = useRef()

  const { mutate: updateAction, isPending } = useUpdateDesignatedAction(
    action?.designatedActionId
  )

  const start = () => {
    setName(action?.name ?? '')
    setCredits(
      action?.creditAllocation === null ||
        action?.creditAllocation === undefined
        ? ''
        : String(action.creditAllocation)
    )
    setCompletionDate(action?.specifiedDate ?? '')
    setError('')
    setOpen(true)
  }

  const submit = () => {
    setError('')
    if (!name.trim()) return
    const creditAllocation = credits === '' ? null : Number(credits)
    if (creditAllocation !== null && !Number.isInteger(creditAllocation)) {
      setError(t('initiativeAgreement:actions.invalidCredits'))
      return
    }
    updateAction(
      {
        name: name.trim(),
        creditAllocation,
        // An empty box means clear the date, which a bare null cannot say.
        ...(completionDate === ''
          ? { clearSpecifiedDate: true }
          : { specifiedDate: completionDate })
      },
      {
        onSuccess: () => {
          setOpen(false)
          onChanged?.()
          alertRef.current?.triggerAlert({
            severity: 'success',
            message: t('initiativeAgreement:actions.editSuccess')
          })
        },
        onError: (err) =>
          setError(
            err?.response?.data?.detail ||
              err?.message ||
              t('initiativeAgreement:actions.editFailed')
          )
      }
    )
  }

  // An action being removed in the change order can't be edited (#5555).
  if (action.changeOrderState === 'removed') return null

  return (
    <Role roles={packageEditorRoles(inChangeOrder)}>
      <FloatingAlert ref={alertRef} data-test="edit-action-alert" />
      <WidgetEditButton
        type="button"
        data-test="edit-designated-action"
        onClick={start}
      >
        {t('initiativeAgreement:actions.edit')}
      </WidgetEditButton>

      <BCModal
        open={open}
        onClose={() => setOpen(false)}
        data={{
          title: t('initiativeAgreement:actions.editTitle'),
          primaryButtonText: t('initiativeAgreement:actions.save'),
          primaryButtonAction: submit,
          primaryButtonDisabled: !name.trim() || isPending,
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <Box
              sx={{
                minWidth: { xs: 'auto', sm: 420 },
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                pt: 1
              }}
            >
              {error && (
                <BCTypography
                  variant="body4"
                  color="error"
                  data-test="edit-action-error"
                >
                  {error}
                </BCTypography>
              )}
              <ModalField
                id="edit-action-name"
                label={t('initiativeAgreement:actions.nameLabel')}
                value={name}
                autoFocus
                inputProps={{ 'data-test': 'edit-action-name' }}
                onChange={(event) => setName(event.target.value)}
              />
              <ModalField
                id="edit-action-credits"
                label={t('initiativeAgreement:actions.creditsLabel')}
                optional
                type="number"
                value={credits}
                inputProps={{ min: 0, 'data-test': 'edit-action-credits' }}
                onChange={(event) => setCredits(event.target.value)}
              />
              <ModalField
                id="edit-action-date"
                label={t('initiativeAgreement:actions.dateLabel')}
                optional
                type="date"
                value={completionDate}
                inputProps={{ 'data-test': 'edit-action-date' }}
                onChange={(event) => setCompletionDate(event.target.value)}
              />
            </Box>
          )
        }}
      />
    </Role>
  )
}

export default EditDesignatedAction
