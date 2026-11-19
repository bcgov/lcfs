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

export const EOCSubmissionHistory = ({ submissions = [], onDownload }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const [expanded, setExpanded] = useState(() =>
    submissions.length ? [String(submissions[0].id ?? 0)] : []
  )
  if (!submissions.length) return null

  return (
    <BCBox mt={3} data-test="eoc-submission-history">
      <BCTypography variant="h6" color="primary" component="h2" mb={1.5}>
        {t('initiativeAgreement:submission.history')}
      </BCTypography>
      {submissions.map((submission, submissionIndex) => {
        const submissionKey = String(submission.id ?? submissionIndex)
        const requirements = submission.requirements || []
        const evidenceResponses = submission.evidenceResponses || {}
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
                  return (
                    <EOCRequirementSection
                      key={id}
                      requirement={{ ...requirement, id }}
                      index={index}
                      response={evidenceResponses[id] || {}}
                      readOnly
                      expanded={submissionIndex === 0 && index === 0}
                      setExpanded={() => {}}
                    />
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
