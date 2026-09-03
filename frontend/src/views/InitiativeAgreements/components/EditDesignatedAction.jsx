import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'

import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import ModalField from './ModalField'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { useUpdateDesignatedAction } from '@/hooks/useInitiativeAgreements'

// Correcting a designated action. Available at any point in the
// agreement's life: an analyst who spots a wrong figure or a mistyped
// name should be able to fix it rather than work around it. Every change
// is recorded in the activity trail with its before and after.
export const EditDesignatedAction = ({ action, onChanged }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [credits, setCredits] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [error, setError] = useState('')

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
    updateAction(
      {
        name: name.trim(),
        creditAllocation: credits === '' ? null : Number(credits),
        // An empty box means clear the date, which a bare null cannot say.
        ...(completionDate === ''
          ? { clearSpecifiedDate: true }
          : { specifiedDate: completionDate })
      },
      {
        onSuccess: () => {
          setOpen(false)
          onChanged?.()
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

  return (
    <Role roles={[roles.ia_analyst, roles.ia_manager]}>
      <BCButton
        type="button"
        variant="outlined"
        color="primary"
        size="small"
        startIcon={<EditOutlinedIcon />}
        data-test="edit-designated-action"
        onClick={start}
      >
        {t('initiativeAgreement:actions.edit')}
      </BCButton>

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
