import { useCallback, useEffect, useRef, useState } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { FloatingAlert } from '@/components/BCAlert'
import { useUpdateOrganizationRepresentativeAgreement } from '@/hooks/useOrganization'
import { SettingRow } from './SettingRow'
import { TEXT_INPUT_HEIGHT, compactRadioProps } from './fieldLayout'

export const REPRESENTATIVE_NAME_MAX_LENGTH = 500

/**
 * Representation agreement on the organization details card: whether a third
 * party is authorized to report on the organization's behalf, and its name.
 *
 * Everyone who can see the card sees the current values as plain text. Only
 * users allowed to edit get live controls (radios, name input, Save/Cancel on
 * one line); the API enforces the same role restriction independently of this
 * UI.
 */
export const RepresentativeAgreement = ({
  orgID,
  hasRepresentativeAgreement,
  representativeOrganizationName,
  canEdit
}) => {
  const { t } = useTranslation(['common', 'org'])
  const alertRef = useRef(null)
  const storedHas = !!hasRepresentativeAgreement
  const storedName = representativeOrganizationName || ''

  const [draftHas, setDraftHas] = useState(storedHas)
  const [draftName, setDraftName] = useState(storedName)
  const [touched, setTouched] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Re-sync whenever the saved values change (after save, or a refetch).
  useEffect(() => {
    setDraftHas(storedHas)
    setDraftName(storedName)
    setTouched(false)
  }, [storedHas, storedName])

  const { mutateAsync } = useUpdateOrganizationRepresentativeAgreement(orgID)

  const trimmedName = draftName.trim()
  const isDirty =
    draftHas !== storedHas || (draftHas && trimmedName !== storedName.trim())

  let nameError = null
  if (canEdit && draftHas && touched) {
    if (!trimmedName) {
      nameError = t('org:representativeNameRequired')
    } else if (trimmedName.length > REPRESENTATIVE_NAME_MAX_LENGTH) {
      nameError = t('org:representativeNameTooLong')
    }
  }

  const handleAgreementChange = useCallback((event) => {
    const next = event.target.value === 'yes'
    setDraftHas(next)
    setTouched(false)
    if (!next) {
      setDraftName('')
    }
  }, [])

  const handleCancel = useCallback(() => {
    setDraftHas(storedHas)
    setDraftName(storedName)
    setTouched(false)
  }, [storedHas, storedName])

  const handleSave = useCallback(async () => {
    setTouched(true)
    if (
      draftHas &&
      (!trimmedName || trimmedName.length > REPRESENTATIVE_NAME_MAX_LENGTH)
    ) {
      return
    }
    setIsSaving(true)
    try {
      await mutateAsync({
        hasRepresentativeAgreement: draftHas,
        representativeOrganizationName: draftHas ? trimmedName : null
      })
      alertRef.current?.triggerAlert({
        message: t('org:representativeAgreementUpdateSuccess'),
        severity: 'success'
      })
    } catch (error) {
      alertRef.current?.triggerAlert({
        message:
          error?.response?.data?.detail ||
          t('org:representativeAgreementUpdateError'),
        severity: 'error'
      })
    } finally {
      setIsSaving(false)
    }
  }, [draftHas, mutateAsync, t, trimmedName])

  const agreementLabelId = 'representative-agreement-label'
  const nameInputId = 'representative-organization-name'

  return (
    <>
      <FloatingAlert
        ref={alertRef}
        data-test="representative-agreement-alert"
      />
      <SettingRow
        label={t('org:representativeAgreementLabel')}
        labelId={agreementLabelId}
        data-test="representative-agreement"
        controlHeight={canEdit ? TEXT_INPUT_HEIGHT : undefined}
        // The error message is absolutely positioned, so reserve room for it
        // below the row to keep it clear of the next setting.
        sx={{ mb: nameError ? 3 : 0 }}
      >
        {canEdit ? (
          <BCBox
            display="flex"
            alignItems="center"
            flexWrap="wrap"
            gap={1}
            width="100%"
          >
            <RadioGroup
              row
              name="hasRepresentativeAgreement"
              aria-labelledby={agreementLabelId}
              value={draftHas ? 'yes' : 'no'}
              onChange={handleAgreementChange}
              sx={{ flexWrap: 'nowrap', alignItems: 'center' }}
            >
              <FormControlLabel
                value="no"
                control={
                  <Radio
                    {...compactRadioProps}
                    data-test="hasRepresentativeAgreementNo"
                  />
                }
                label={
                  <BCTypography variant="body4">{t('common:no')}</BCTypography>
                }
              />
              <FormControlLabel
                value="yes"
                sx={{ ml: 2, mr: 2 }}
                control={
                  <Radio
                    {...compactRadioProps}
                    data-test="hasRepresentativeAgreementYes"
                  />
                }
                label={
                  <BCTypography variant="body4">
                    {draftHas
                      ? t('org:representativeYesOrgName')
                      : t('common:yes')}
                  </BCTypography>
                }
              />
            </RadioGroup>
            {draftHas && (
              <TextField
                id={nameInputId}
                size="small"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => setTouched(true)}
                required
                placeholder={t('org:representativeOrgNamePlaceholder')}
                error={!!nameError}
                helperText={nameError || undefined}
                inputProps={{
                  'aria-label': t('org:representativeOrgNameLabel'),
                  'aria-required': true,
                  'data-test': 'representativeOrganizationName',
                  maxLength: REPRESENTATIVE_NAME_MAX_LENGTH + 1
                }}
                // Keep the error message out of the row's height so the input
                // stays centred with the radios when it appears.
                FormHelperTextProps={{
                  sx: { position: 'absolute', top: '100%', ml: 0 }
                }}
                sx={{
                  width: 320,
                  position: 'relative'
                }}
              />
            )}
            {isDirty && (
              <BCBox display="flex" gap={1}>
                <BCButton
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={handleSave}
                  isLoading={isSaving}
                  data-test="representative-agreement-save"
                >
                  {t('common:saveBtn')}
                </BCButton>
                <BCButton
                  variant="outlined"
                  color="primary"
                  size="small"
                  onClick={handleCancel}
                  disabled={isSaving}
                  data-test="representative-agreement-cancel"
                >
                  {t('common:cancelBtn')}
                </BCButton>
              </BCBox>
            )}
          </BCBox>
        ) : (
          <BCTypography
            variant="body4"
            data-test="representative-agreement-value"
          >
            {storedHas ? `${t('common:yes')} — ${storedName}` : t('common:no')}
          </BCTypography>
        )}
      </SettingRow>
    </>
  )
}
