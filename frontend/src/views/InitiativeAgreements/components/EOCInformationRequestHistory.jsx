import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import BCTypography from '@/components/BCTypography'
import { dateFormatter } from '@/utils/formatters'
import { EOCRequirementResponses } from './EOCRequirementResponses'
import EOCInformationRequestDocuments from './EOCInformationRequestDocuments'
import { evidenceEditorHtml } from './evidenceRichText'

const STATUS_REQUESTED = 'Requested'
const STATUS_SUBMITTED = 'Submitted'

/** The analyst's Missing information text, sanitized for display. */
export const MissingInformationText = ({ value, ...props }) => (
  <Box
    {...props}
    sx={{
      borderLeft: '3px solid',
      borderColor: 'primary.main',
      bgcolor: 'background.default',
      px: 1.5,
      py: 1,
      fontSize: '0.875rem',
      lineHeight: 1.5,
      '& p': { m: 0 },
      ...(props.sx || {})
    }}
    // Sanitized with the same allow-list as comments and notes.
    dangerouslySetInnerHTML={{ __html: evidenceEditorHtml(value) }}
  />
)

const formatDate = (value) => (value ? dateFormatter({ value }) : '')

/**
 * Every request for additional information on one EOC, oldest first, with
 * what was asked and what came back (#5545). Read-only: the open request is
 * edited in EOCInformationRequestSection.
 */
export const EOCInformationRequestHistory = ({
  designatedActionId,
  requests = [],
  requirementId
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  if (!requests.length) return null

  const statusText = (request) => {
    if (request.status === STATUS_SUBMITTED) {
      return t('initiativeAgreement:informationRequest.statusSubmitted', {
        date: formatDate(request.submittedAt),
        by: request.submittedBy
          ? t('initiativeAgreement:informationRequest.requestedBy', {
              name: request.submittedBy
            })
          : ''
      })
    }
    if (request.status === STATUS_REQUESTED) {
      return t('initiativeAgreement:informationRequest.statusRequested')
    }
    return t('initiativeAgreement:informationRequest.statusSuperseded')
  }

  return (
    <Box
      component="section"
      aria-labelledby={`eoc-information-history-${requirementId}`}
      data-test={`eoc-information-history-${requirementId}`}
      sx={{ mt: 2.5 }}
    >
      <BCTypography
        id={`eoc-information-history-${requirementId}`}
        variant="body4"
        component="h3"
        sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}
      >
        {t('initiativeAgreement:informationRequest.history')}
      </BCTypography>
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {requests.map((request, index) => (
          <Box
            component="li"
            key={request.id}
            data-test={`eoc-information-cycle-${request.id}`}
            sx={{ mb: 2 }}
          >
            {index > 0 && <Divider sx={{ mb: 2 }} />}
            <BCTypography
              variant="body4"
              component="p"
              sx={{ fontWeight: 700 }}
            >
              {t('initiativeAgreement:informationRequest.cycle', {
                number: index + 1
              })}
              {' — '}
              {t('initiativeAgreement:informationRequest.requestedOn', {
                date: formatDate(request.requestedAt)
              })}
              {request.requestedBy
                ? t('initiativeAgreement:informationRequest.requestedBy', {
                    name: request.requestedBy
                  })
                : ''}
            </BCTypography>
            <BCTypography
              variant="body4"
              component="p"
              sx={{ mt: 0.75, mb: 0.5, color: 'primary.main', fontWeight: 700 }}
            >
              {t('initiativeAgreement:informationRequest.whatIsNeeded')}
            </BCTypography>
            <MissingInformationText value={request.missingInformation} />
            <BCTypography
              variant="body4"
              component="p"
              sx={{ mt: 1 }}
              data-test={`eoc-information-cycle-status-${request.id}`}
            >
              {statusText(request)}
            </BCTypography>
            {request.status === STATUS_SUBMITTED && request.response && (
              <Box sx={{ mt: 1.5 }}>
                <BCTypography
                  variant="body4"
                  component="p"
                  sx={{ mb: 1, color: 'primary.main', fontWeight: 700 }}
                >
                  {t('initiativeAgreement:informationRequest.responseHeading')}
                </BCTypography>
                <EOCRequirementResponses
                  requirement={{ id: `${requirementId}-request-${request.id}` }}
                  response={request.response}
                  readOnly
                />
                <Box mt={1.5}>
                  <EOCInformationRequestDocuments
                    designatedActionId={designatedActionId}
                    request={request}
                  />
                </Box>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default EOCInformationRequestHistory
