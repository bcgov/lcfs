import { useState } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Button from '@mui/material/Button'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import BCBox from '@/components/BCBox'
import EOCRequirementSection from './EOCRequirementSection'
import EOCInformationRequestHistory from './EOCInformationRequestHistory'

const sectionKey = (submissionKey, requirementId) =>
  `${submissionKey}:${requirementId}`

export const EOCSubmissionHistory = ({
  submissions = [],
  onDownload,
  designatedActionId,
  // Requests for additional information by submission ID (#5545).
  informationRequests = {}
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const [expanded, setExpanded] = useState(() =>
    submissions.length ? [String(submissions[0].id ?? 0)] : []
  )
  // Each EOC of each submission opens on its own; the first EOC of the
  // latest submission starts open.
  const [expandedSections, setExpandedSections] = useState(() => {
    const first = submissions[0]
    const requirement = first?.requirements?.[0]
    if (!first || !requirement) return []
    return [
      sectionKey(
        String(first.id ?? 0),
        String(requirement.id ?? requirement.evidenceRequirementId)
      )
    ]
  })
  if (!submissions.length) return null

  const toggleSection = (key, open) =>
    setExpandedSections((previous) =>
      open
        ? previous.includes(key)
          ? previous
          : [...previous, key]
        : previous.filter((item) => item !== key)
    )

  return (
    <BCBox mt={3} data-test="eoc-submission-history">
      <BCTypography variant="h6" color="primary" component="h2" mb={1.5}>
        {t('initiativeAgreement:submission.history')}
      </BCTypography>
      {submissions.map((submission, submissionIndex) => {
        const submissionKey = String(submission.id ?? submissionIndex)
        const requirements = submission.requirements || []
        const evidenceResponses = submission.evidenceResponses || {}
        const requests = informationRequests[String(submission.id)] || []
        return (
          <Accordion
            key={submissionKey}
            expanded={expanded.includes(submissionKey)}
            onChange={(_, isExpanded) =>
              setExpanded((previous) =>
                isExpanded
                  ? [...previous, submissionKey]
                  : previous.filter((id) => id !== submissionKey)
              )
            }
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              {t('initiativeAgreement:submission.submittedAt', {
                date: submission.submittedAt
                  ? new Date(submission.submittedAt).toLocaleString()
                  : t('initiativeAgreement:submission.noValue')
              })}
            </AccordionSummary>
            <AccordionDetails>
              {submission.documents?.map((document) => (
                <Button
                  key={document.documentId}
                  onClick={() => onDownload(submission.id, document)}
                  sx={{ mr: 1, mb: 1 }}
                >
                  {[...(document.folderPath || []), document.fileName].join(
                    ' / '
                  )}
                </Button>
              ))}
              <BCBox
                sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
              >
                {requirements.map((requirement, index) => {
                  const id = String(
                    requirement.id ?? requirement.evidenceRequirementId
                  )
                  const key = sectionKey(submissionKey, id)
                  const eocRequests = requests.filter(
                    (request) => String(request.evidenceRequirementId) === id
                  )
                  const open = eocRequests.some(
                    (request) => request.status === 'Requested'
                  )
                  return (
                    <EOCRequirementSection
                      key={id}
                      requirement={{ ...requirement, id }}
                      index={index}
                      response={evidenceResponses[id] || {}}
                      readOnly
                      expanded={expandedSections.includes(key)}
                      setExpanded={(isOpen) => toggleSection(key, isOpen)}
                      statusLabel={
                        open
                          ? t(
                              'initiativeAgreement:informationRequest.requested'
                            )
                          : null
                      }
                    >
                      <EOCInformationRequestHistory
                        designatedActionId={designatedActionId}
                        requests={eocRequests}
                        requirementId={key}
                      />
                    </EOCRequirementSection>
                  )
                })}
              </BCBox>
            </AccordionDetails>
          </Accordion>
        )
      })}
    </BCBox>
  )
}

export default EOCSubmissionHistory
