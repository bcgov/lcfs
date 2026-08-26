import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { useCreateDesignatedAction } from '@/hooks/useInitiativeAgreements'

// Adding a designated action to an agreement that is still a draft.
// Designated actions are the substance of the agreement, so they are
// settled before it takes effect; once it is underway the route is a
// change order, not a new row beside the signed schedule. The API
// enforces that too — this only hides a control that would be refused.
export const AddDesignatedAction = ({ initiativeAgreementId, isDraft }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [credits, setCredits] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [error, setError] = useState('')

  const { mutate: createAction, isPending } = useCreateDesignatedAction(
    initiativeAgreementId
  )

  if (!isDraft) return null

  const close = () => {
    setOpen(false)
    setName('')
    setCredits('')
    setCompletionDate('')
    setError('')
  }

  const submit = () => {
    setError('')
    // The button is disabled without a name, but the guard belongs with
    // the action rather than only in the control's appearance.
    if (!name.trim()) return
    createAction(
      {
        name: name.trim(),
        creditAllocation: credits === '' ? null : Number(credits),
        specifiedDate: completionDate === '' ? null : completionDate
      },
      {
        onSuccess: close,
        onError: (err) =>
          setError(
            err?.response?.data?.detail ||
              err?.message ||
              t('initiativeAgreement:actions.createFailed')
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
        startIcon={<AddIcon />}
        data-test="add-designated-action"
        onClick={() => setOpen(true)}
      >
        {t('initiativeAgreement:actions.add')}
      </BCButton>

      <BCModal
        open={open}
        onClose={close}
        data={{
          title: t('initiativeAgreement:actions.addTitle'),
          primaryButtonText: t('initiativeAgreement:actions.create'),
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
                  data-test="add-action-error"
                >
                  {error}
                </BCTypography>
              )}
              <TextField
                fullWidth
                autoFocus
                size="small"
                label={t('initiativeAgreement:actions.nameLabel')}
                value={name}
                inputProps={{ 'data-test': 'new-action-name' }}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t('initiativeAgreement:actions.creditsLabel')}
                value={credits}
                inputProps={{ min: 0, 'data-test': 'new-action-credits' }}
                onChange={(event) => setCredits(event.target.value)}
              />
              <TextField
                fullWidth
                size="small"
                type="date"
                label={t('initiativeAgreement:actions.dateLabel')}
                value={completionDate}
                InputLabelProps={{ shrink: true }}
                inputProps={{ 'data-test': 'new-action-date' }}
                onChange={(event) => setCompletionDate(event.target.value)}
              />
            </Box>
          )
        }}
      />
    </Role>
  )
}

export default AddDesignatedAction
