import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Stack,
  TextField
} from '@mui/material'

import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Step 4 — Sign & submit. Renders a locked summary of the CI application
 * (Steps 1-3) plus the three required declarations, signing-authority
 * info auto-filled from the current user, and an optional consultant
 * block. The `Submit application` button performs final validation and
 * delegates the actual mutation to the parent through `onSave`.
 *
 * The consultant fields auto-save on blur through `onAutoSave` (#4772).
 * Step 4 had no save path at all, so details typed here were lost whenever
 * the applicant left the draft instead of submitting.
 */
export const SignAndSubmitStep = ({
  ciApplication,
  currentUser,
  onSave,
  onAutoSave,
  onDelete,
  isSaving = false,
  readOnly = false
}) => {
  const { t } = useTranslation(['common', 'carbonIntensity'])

  const [decl1, setDecl1] = useState(false)
  const [decl2, setDecl2] = useState(false)
  const [decl3, setDecl3] = useState(false)

  const [consultantConsent, setConsultantConsent] = useState(
    !!ciApplication?.consultantName ||
      !!ciApplication?.consultantCompany ||
      !!ciApplication?.consultantEmail
  )
  const [consultantName, setConsultantName] = useState(
    ciApplication?.consultantName || ''
  )
  const [consultantCompany, setConsultantCompany] = useState(
    ciApplication?.consultantCompany || ''
  )
  const [consultantEmail, setConsultantEmail] = useState(
    ciApplication?.consultantEmail || ''
  )

  const [errors, setErrors] = useState({})

  // Last values known to be persisted, so a blur that changed nothing does not
  // fire a redundant request (and a redundant toast).
  const savedRef = useRef({
    consent: consultantConsent,
    name: consultantName,
    company: consultantCompany,
    email: consultantEmail
  })

  const ciApplicationId = ciApplication?.ciApplicationId

  // Re-seed when a *different* application loads. Keyed on the id rather than
  // the object: an auto-save response is a new object, and re-seeding on that
  // would overwrite whichever field the applicant is currently typing in.
  useEffect(() => {
    const name = ciApplication?.consultantName || ''
    const company = ciApplication?.consultantCompany || ''
    const email = ciApplication?.consultantEmail || ''
    // Derive consent from stored values, otherwise reopening a draft renders
    // the box unticked and hides the applicant's own saved details.
    const consent = !!(name || company || email)
    setConsultantName(name)
    setConsultantCompany(company)
    setConsultantEmail(email)
    setConsultantConsent(consent)
    savedRef.current = { consent, name, company, email }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciApplicationId])

  /**
   * Persist the consultant block if it differs from what is already stored.
   * No-ops before Step 1 has created the draft, and while read-only.
   */
  const autoSave = useCallback(
    (next) => {
      if (readOnly || !ciApplicationId || !onAutoSave) return
      const prev = savedRef.current
      if (
        prev.consent === next.consent &&
        prev.name === next.name &&
        prev.company === next.company &&
        prev.email === next.email
      ) {
        return
      }
      savedRef.current = next
      onAutoSave({
        consultantConsent: next.consent,
        consultantName: next.consent ? next.name.trim() || null : null,
        consultantCompany: next.consent ? next.company.trim() || null : null,
        consultantEmail: next.consent ? next.email.trim() || null : null
      })
    },
    [readOnly, ciApplicationId, onAutoSave]
  )

  const handleConsultantBlur = useCallback(() => {
    autoSave({
      consent: consultantConsent,
      name: consultantName,
      company: consultantCompany,
      email: consultantEmail
    })
  }, [
    autoSave,
    consultantConsent,
    consultantName,
    consultantCompany,
    consultantEmail
  ])

  const handleConsentChange = useCallback(
    (checked) => {
      setConsultantConsent(checked)
      // Withdrawing consent clears the stored values immediately, matching
      // what submission already does server-side. Ticking the box has nothing
      // to persist yet, so it waits for the first field blur.
      if (!checked) {
        autoSave({ consent: false, name: '', company: '', email: '' })
      }
    },
    [autoSave]
  )

  const signingAuthority = useMemo(() => {
    if (!currentUser) return { name: '', title: '', email: '' }
    return {
      name: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
      title: currentUser.title || '',
      email: currentUser.email || ''
    }
  }, [currentUser])

  const handleSubmit = () => {
    const newErrors = {}
    if (!(decl1 && decl2 && decl3)) {
      newErrors.declarations = t(
        'carbonIntensity:step4.validation.allDeclarationsRequired'
      )
    }
    if (consultantConsent) {
      if (!consultantName.trim()) {
        newErrors.consultantName = t(
          'carbonIntensity:step4.validation.consultantNameRequired'
        )
      }
      if (!consultantCompany.trim()) {
        newErrors.consultantCompany = t(
          'carbonIntensity:step4.validation.consultantCompanyRequired'
        )
      }
      if (!consultantEmail.trim()) {
        newErrors.consultantEmail = t(
          'carbonIntensity:step4.validation.consultantEmailRequired'
        )
      } else if (!EMAIL_REGEX.test(consultantEmail.trim())) {
        newErrors.consultantEmail = t(
          'carbonIntensity:step4.validation.consultantEmailInvalid'
        )
      }
    }
    if (Object.keys(newErrors).length) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    onSave?.({
      declarationInformationTrue: decl1,
      declarationResponse8Weeks: decl2,
      declarationSection206: decl3,
      consultantConsent,
      consultantName: consultantConsent ? consultantName.trim() : null,
      consultantCompany: consultantConsent ? consultantCompany.trim() : null,
      consultantEmail: consultantConsent ? consultantEmail.trim() : null
    })
  }

  return (
    <Box>
      <BCTypography
        variant="subtitle1"
        sx={{ fontWeight: 600, mb: 1 }}
        data-test="ci-step4-signing-authority-header"
      >
        {t('carbonIntensity:step4.signingAuthorityHeader')}
      </BCTypography>

      <Stack spacing={2.5} sx={{ mb: 3 }}>
        <FormControl error={!!errors.declarations}>
          <Stack spacing={2}>
            <FormControlLabel
              sx={{ alignItems: 'flex-start', m: 0 }}
              control={
                <Checkbox
                  checked={decl1}
                  onChange={(e) => setDecl1(e.target.checked)}
                  disabled={readOnly}
                  sx={{ pt: 0, pb: 0 }}
                  inputProps={{ 'data-test': 'ci-step4-decl-1' }}
                />
              }
              label={
                <BCTypography variant="body2" component="span">
                  {t('carbonIntensity:step4.declarations.informationTrue')}{' '}
                  <BCTypography
                    component="span"
                    variant="body2"
                    sx={{ fontStyle: 'italic', fontWeight: 700 }}
                  >
                    {t('carbonIntensity:step4.declarations.requiredSuffix')}
                  </BCTypography>
                </BCTypography>
              }
            />
            <FormControlLabel
              sx={{ alignItems: 'flex-start', m: 0 }}
              control={
                <Checkbox
                  checked={decl2}
                  onChange={(e) => setDecl2(e.target.checked)}
                  disabled={readOnly}
                  sx={{ pt: 0, pb: 0 }}
                  inputProps={{ 'data-test': 'ci-step4-decl-2' }}
                />
              }
              label={
                <BCTypography variant="body2" component="span">
                  {t('carbonIntensity:step4.declarations.response8Weeks')}{' '}
                  <BCTypography
                    component="span"
                    variant="body2"
                    sx={{ fontStyle: 'italic', fontWeight: 700 }}
                  >
                    {t('carbonIntensity:step4.declarations.requiredSuffix')}
                  </BCTypography>
                </BCTypography>
              }
            />
            <FormControlLabel
              sx={{ alignItems: 'flex-start', m: 0 }}
              control={
                <Checkbox
                  checked={decl3}
                  onChange={(e) => setDecl3(e.target.checked)}
                  disabled={readOnly}
                  sx={{ pt: 0, pb: 0 }}
                  inputProps={{ 'data-test': 'ci-step4-decl-3' }}
                />
              }
              label={
                <BCTypography variant="body2" component="span">
                  {t('carbonIntensity:step4.declarations.section206')}{' '}
                  <BCTypography
                    component="span"
                    variant="body2"
                    sx={{ fontStyle: 'italic', fontWeight: 700 }}
                  >
                    {t('carbonIntensity:step4.declarations.requiredSuffix')}
                  </BCTypography>
                </BCTypography>
              }
            />
          </Stack>
          {errors.declarations && (
            <FormHelperText data-test="ci-step4-decl-error" sx={{ mt: 1 }}>
              {errors.declarations}
            </FormHelperText>
          )}
        </FormControl>
      </Stack>

      <BCBox sx={{ mb: 3 }} data-test="ci-step4-signing-authority-block">
        <BCTypography variant="body2">
          <strong>{t('carbonIntensity:step4.signingAuthorityLabel')}</strong>{' '}
          {signingAuthority.name}
        </BCTypography>
        {signingAuthority.title && (
          <BCTypography variant="body2">
            <strong>{t('carbonIntensity:step4.titleLabel')}</strong>{' '}
            {signingAuthority.title}
          </BCTypography>
        )}
        <BCTypography variant="body2">
          <strong>{t('carbonIntensity:step4.emailLabel')}</strong>{' '}
          {signingAuthority.email}
        </BCTypography>
      </BCBox>

      <BCBox
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
          mb: 2
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={consultantConsent}
              onChange={(e) => handleConsentChange(e.target.checked)}
              disabled={readOnly}
              inputProps={{ 'data-test': 'ci-step4-consultant-consent' }}
            />
          }
          label={t('carbonIntensity:step4.consultantConsentLabel')}
        />
        {consultantConsent && (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ mt: 2 }}
          >
            <Box flex={1}>
              <InputLabel htmlFor="ci-step4-consultant-name" sx={{ pb: 1 }}>
                {t('carbonIntensity:step4.consultantNameLabel')}
              </InputLabel>
              <TextField
                id="ci-step4-consultant-name"
                value={consultantName}
                onChange={(e) => {
                  setConsultantName(e.target.value)
                  if (errors.consultantName) {
                    setErrors((prev) => ({
                      ...prev,
                      consultantName: undefined
                    }))
                  }
                }}
                onBlur={handleConsultantBlur}
                disabled={readOnly}
                fullWidth
                variant="outlined"
                error={!!errors.consultantName}
                helperText={errors.consultantName}
                inputProps={{ 'data-test': 'ci-step4-consultant-name' }}
              />
            </Box>
            <Box flex={1}>
              <InputLabel htmlFor="ci-step4-consultant-company" sx={{ pb: 1 }}>
                {t('carbonIntensity:step4.consultantCompanyLabel')}
              </InputLabel>
              <TextField
                id="ci-step4-consultant-company"
                value={consultantCompany}
                onChange={(e) => {
                  setConsultantCompany(e.target.value)
                  if (errors.consultantCompany) {
                    setErrors((prev) => ({
                      ...prev,
                      consultantCompany: undefined
                    }))
                  }
                }}
                onBlur={handleConsultantBlur}
                disabled={readOnly}
                fullWidth
                variant="outlined"
                error={!!errors.consultantCompany}
                helperText={errors.consultantCompany}
                inputProps={{ 'data-test': 'ci-step4-consultant-company' }}
              />
            </Box>
            <Box flex={1}>
              <InputLabel htmlFor="ci-step4-consultant-email" sx={{ pb: 1 }}>
                {t('carbonIntensity:step4.consultantEmailLabel')}
              </InputLabel>
              <TextField
                id="ci-step4-consultant-email"
                value={consultantEmail}
                onChange={(e) => {
                  setConsultantEmail(e.target.value)
                  if (errors.consultantEmail) {
                    setErrors((prev) => ({
                      ...prev,
                      consultantEmail: undefined
                    }))
                  }
                }}
                onBlur={handleConsultantBlur}
                disabled={readOnly}
                fullWidth
                variant="outlined"
                error={!!errors.consultantEmail}
                helperText={errors.consultantEmail}
                inputProps={{ 'data-test': 'ci-step4-consultant-email' }}
              />
            </Box>
          </Stack>
        )}
      </BCBox>

      {/* Delete sits far right, away from the primary action (#4770). */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 2 }}
        alignItems="center"
        justifyContent="space-between"
      >
        <BCButton
          type="button"
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={readOnly || isSaving || !(decl1 && decl2 && decl3)}
          data-test="ci-step4-submit-btn"
        >
          {t('carbonIntensity:step4.submit')}
        </BCButton>
        {ciApplication?.ciApplicationId && onDelete && (
          <BCButton
            type="button"
            variant="outlined"
            color="error"
            onClick={onDelete}
            disabled={readOnly || isSaving}
            data-test="ci-step4-delete-btn"
          >
            {t('carbonIntensity:step1.deleteDraft')}
          </BCButton>
        )}
      </Stack>
    </Box>
  )
}

SignAndSubmitStep.displayName = 'SignAndSubmitStep'
