import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import BCButton from '@/components/BCButton'
import { useRequestEocInformation } from '@/hooks/useInitiativeAgreements'
import { dateFormatter } from '@/utils/formatters'

const errorDetail = (err) => err?.response?.data?.detail || err?.message || ''

/**
 * The IDIR evidence card's "Request additional information" for one EOC of a
 * submitted DA/EOC submission (#5545). It sends the EOC's saved Missing
 * information; the server checks it is not empty. While the request is open
 * the card says so instead.
 */
export const EOCInformationRequestAction = ({
  designatedActionId,
  requirement,
  eoc,
  canRequest = false,
  beforeRequest
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const errorId = useId()
  const [error, setError] = useState('')
  const [waiting, setWaiting] = useState(false)
  const { mutateAsync: requestInformation, isPending } =
    useRequestEocInformation(designatedActionId)
  const id = requirement.evidenceRequirementId
  const open = (eoc?.informationRequests || []).find(
    (request) =>
      request.evidenceRequirementId === id && request.status === 'Requested'
  )

  if (open) {
    return (
      <Alert
        severity="info"
        role="status"
        data-test={`eoc-information-open-${id}`}
      >
        {t('initiativeAgreement:informationRequest.openNotice', {
          date: open.requestedAt
            ? dateFormatter({ value: open.requestedAt })
            : '',
          by: open.requestedBy
            ? t('initiativeAgreement:informationRequest.requestedBy', {
                name: open.requestedBy
              })
            : ''
        })}
      </Alert>
    )
  }
  if (!canRequest || !eoc?.informationRequestAvailable) return null

  const send = async () => {
    setError('')
    setWaiting(true)
    try {
      // The Missing information field saves on blur; send what was saved.
      await beforeRequest?.()
      await requestInformation({ evidenceRequirementId: id })
    } catch (err) {
      setError(
        errorDetail(err) ||
          t('initiativeAgreement:informationRequest.requestFailed')
      )
    } finally {
      setWaiting(false)
    }
  }

  const busy = waiting || isPending
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {error && (
        <Alert
          severity="error"
          role="alert"
          id={errorId}
          data-test={`eoc-information-request-error-${id}`}
        >
          {error}
        </Alert>
      )}
      <Box>
        <BCButton
          variant="contained"
          color="primary"
          size="small"
          disabled={busy}
          onClick={send}
          aria-label={t(
            'initiativeAgreement:informationRequest.requestButtonFor',
            { number: requirement.requirementNumber }
          )}
          aria-describedby={error ? errorId : undefined}
          data-test={`eoc-information-request-button-${id}`}
        >
          {busy
            ? t('initiativeAgreement:informationRequest.requesting')
            : t('initiativeAgreement:informationRequest.requestButton')}
        </BCButton>
      </Box>
    </Box>
  )
}

export default EOCInformationRequestAction
