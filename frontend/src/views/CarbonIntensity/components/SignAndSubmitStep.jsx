import { useEffect, useMemo, useState } from 'react'
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

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import colors from '@/themes/base/colors'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Step 4 — Sign & submit. Renders a locked summary of the CI application
 * (Steps 1-3) plus the three required declarations, signing-authority
 * info auto-filled from the current user, and an optional consultant
 * block. The `Submit application` button performs final validation and
 * delegates the actual mutation to the parent through `onSave`.
 */
export const SignAndSubmitStep = ({
  ciApplication,
  currentUser,
  onSave,
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

  // Re-seed when the parent reloads the application
  useEffect(() => {
    setConsultantName(ciApplication?.consultantName || '')
    setConsultantCompany(ciApplication?.consultantCompany || '')
    setConsultantEmail(ciApplication?.consultantEmail || '')
  }, [ciApplication])

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
      if (!consultantName.trim() || !consultantCompany.trim() || !consultantEmail.trim()) {
        newErrors.consultant = t(
          'carbonIntensity:step4.validation.consultantFieldsRequired'
        )
      } else if (!EMAIL_REGEX.test(consultantEmail.trim())) {
        newErrors.consultant = t(
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
      <BCTypography variant="h6" sx={{ pb: 2, color: colors.primary.main }}>
        {t('carbonIntensity:step4.title')}
      </BCTypography>

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
              onChange={(e) => setConsultantConsent(e.target.checked)}
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
                onChange={(e) => setConsultantName(e.target.value)}
                disabled={readOnly}
                fullWidth
                variant="outlined"
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
                onChange={(e) => setConsultantCompany(e.target.value)}
                disabled={readOnly}
                fullWidth
                variant="outlined"
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
                onChange={(e) => setConsultantEmail(e.target.value)}
                disabled={readOnly}
                fullWidth
                variant="outlined"
                inputProps={{ 'data-test': 'ci-step4-consultant-email' }}
              />
            </Box>
          </Stack>
        )}
        {errors.consultant && (
          <BCAlert severity="error" sx={{ mt: 1 }} data-test="ci-step4-consultant-error">
            {errors.consultant}
          </BCAlert>
        )}
      </BCBox>

      <Stack direction="row" spacing={2} sx={{ mt: 2 }} alignItems="center">
        <BCButton
          type="button"
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={readOnly || isSaving}
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
