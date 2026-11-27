import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import {
  useSaveEocInformationResponse,
  useSubmitEocInformationResponse
} from '@/hooks/useInitiativeAgreements'
import { dateFormatter } from '@/utils/formatters'
import EOCRequirementSection from './EOCRequirementSection'
import EOCInformationRequestDocuments from './EOCInformationRequestDocuments'
import { MissingInformationText } from './EOCInformationRequestHistory'

const EMPTY_RESPONSE = {
  summaryOfWorkCompleted: '',
  howEvidenceMeetsAgreementRequirements: '',
  exceptionsLimitationsAndContext: ''
}

const errorDetail = (err) => err?.response?.data?.detail || err?.message || ''

/**
 * The one EOC a request for additional information opened to the proponent
 * (#5545): what government asked, the EOC's response fields, its files, and
 * Submit additional information. Every other EOC on the page stays read-only.
 */
export const EOCInformationRequestSection = ({
  designatedActionId,
  requirement,
  index,
  request,
  isSigner = false,
  expanded,
  setExpanded,
  onAnnounce = () => {}
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const number = requirement.requirementNumber ?? index + 1
  const [response, setResponse] = useState(() => ({
    ...EMPTY_RESPONSE,
    ...(request.response || {})
  }))
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const errorRef = useRef(null)
  const { mutateAsync: save, isPending: saving } =
    useSaveEocInformationResponse(designatedActionId)
  const { mutateAsync: submit, isPending: submitting } =
    useSubmitEocInformationResponse(designatedActionId)
  const busy = saving || submitting

  useEffect(() => {
    if (!dirty) setResponse({ ...EMPTY_RESPONSE, ...(request.response || {}) })
  }, [request.response, dirty])

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  const announce = (text) => {
    setStatus(text)
    onAnnounce(text)
  }

  const handleSave = async () => {
    setError('')
    try {
      await save({ requestId: request.id, response })
      setDirty(false)
      announce(t('initiativeAgreement:informationRequest.saved'))
    } catch (err) {
      setError(
        errorDetail(err) ||
          t('initiativeAgreement:informationRequest.saveFailed')
      )
    }
  }

  const handleSubmit = async () => {
    setError('')
    try {
      await submit({ requestId: request.id, response })
      setDirty(false)
      // This section closes once the answer is in; the page's live region
      // carries the confirmation.
      onAnnounce(t('initiativeAgreement:informationRequest.submitted'))
    } catch (err) {
      setError(
        errorDetail(err) ||
          t('initiativeAgreement:informationRequest.submitFailed')
      )
    }
  }

  const requestedOn = request.requestedAt
    ? dateFormatter({ value: request.requestedAt })
    : ''

  return (
    <EOCRequirementSection
      requirement={requirement}
      index={index}
      response={response}
      expanded={expanded}
      setExpanded={setExpanded}
      readOnly={false}
      saving={busy}
      showSave={false}
      statusLabel={t('initiativeAgreement:informationRequest.requested')}
      onChange={(field, value) => {
        setDirty(true)
        setResponse((previous) => ({ ...previous, [field]: value }))
      }}
      intro={
        <Alert
          severity="warning"
          role="note"
          sx={{ mb: 2.5 }}
          data-test={`eoc-information-request-${request.id}`}
        >
          <BCTypography component="p" variant="body4" sx={{ fontWeight: 700 }}>
            {t('initiativeAgreement:informationRequest.whatIsNeeded')}
            {requestedOn &&
              ` (${t('initiativeAgreement:informationRequest.requestedOn', {
                date: requestedOn
              })})`}
          </BCTypography>
          <MissingInformationText
            value={request.missingInformation}
            sx={{ mt: 1, bgcolor: 'transparent' }}
            data-test={`eoc-information-missing-${request.id}`}
          />
        </Alert>
      }
    >
      <Box mt={2.5}>
        <EOCInformationRequestDocuments
          designatedActionId={designatedActionId}
          request={request}
          requirementNumber={number}
          editable
          onAnnounce={announce}
        />
      </Box>
      {error && (
        <Alert
          severity="error"
          role="alert"
          ref={errorRef}
          tabIndex={-1}
          sx={{ mt: 2 }}
          data-test={`eoc-information-error-${request.id}`}
        >
          {error}
        </Alert>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ mt: 2.5 }}
      >
        <BCButton
          variant="outlined"
          color="primary"
          size="small"
          disabled={busy}
          onClick={handleSave}
          data-test={`eoc-information-save-${request.id}`}
        >
          {t('initiativeAgreement:informationRequest.saveDraft')}
        </BCButton>
        {isSigner && request.canSubmit ? (
          <BCButton
            variant="contained"
            color="primary"
            size="small"
            disabled={busy}
            onClick={handleSubmit}
            aria-label={t(
              'initiativeAgreement:informationRequest.submitButtonFor',
              { number }
            )}
            data-test={`eoc-information-submit-${request.id}`}
          >
            {t('initiativeAgreement:informationRequest.submitButton')}
          </BCButton>
        ) : (
          <BCTypography
            variant="body4"
            component="p"
            color="text.secondary"
            data-test={`eoc-information-signer-note-${request.id}`}
          >
            {t('initiativeAgreement:informationRequest.signerRequired')}
          </BCTypography>
        )}
      </Stack>
      <BCTypography
        component="p"
        variant="body4"
        role="status"
        aria-live="polite"
        sx={{ mt: 1, minHeight: '1.5em' }}
        data-test={`eoc-information-status-${request.id}`}
      >
        {busy
          ? t('initiativeAgreement:submission.saving')
          : // Unsaved text stays flagged until it is saved; file changes
            // are saved as they happen and announce on the page.
            dirty
            ? t('initiativeAgreement:informationRequest.unsavedChanges')
            : status}
      </BCTypography>
    </EOCRequirementSection>
  )
}

export default EOCInformationRequestSection
