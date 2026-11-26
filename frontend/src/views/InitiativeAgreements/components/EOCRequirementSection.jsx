import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import { evidencePlainText } from './evidenceRichText'
import { EOCRequirementResponses } from './EOCRequirementResponses'

export const EOCRequirementSection = ({
  requirement,
  index,
  response,
  expanded,
  setExpanded,
  readOnly = false,
  saving = false,
  onChange,
  onSave
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const title =
    requirement.title ||
    evidencePlainText(requirement.description) ||
    t('initiativeAgreement:submission.evidenceRequirement')
  const heading = `${requirement.requirementNumber ?? index + 1}. ${title}`

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      data-test={`eoc-response-section-${requirement.id}`}
      sx={{
        border: '1px solid #8c8c8c',
        '&:before': { display: 'none' },
        '&.Mui-expanded': { m: 0 }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        id={`eoc-response-heading-${requirement.id}`}
        aria-controls={`eoc-response-details-${requirement.id}`}
        sx={{
          minHeight: 62,
          '& .MuiAccordionSummary-content': { my: 1.5 },
          color: 'primary.main',
          fontWeight: 700
        }}
      >
        {heading}
      </AccordionSummary>
      <AccordionDetails
        id={`eoc-response-details-${requirement.id}`}
        sx={{ px: 2.5, pb: 2.5 }}
      >
        <EOCRequirementResponses
          requirement={requirement}
          response={response}
          readOnly={readOnly}
          saving={saving}
          onChange={onChange}
        />
        {!readOnly && (
          <BCBox mt={2}>
            <BCButton
              variant="contained"
              color="primary"
              size="small"
              disabled={saving}
              onClick={onSave}
              data-test={`eoc-response-save-${requirement.id}`}
            >
              {t('initiativeAgreement:submission.save')}
            </BCButton>
          </BCBox>
        )}
      </AccordionDetails>
    </Accordion>
  )
}

export default EOCRequirementSection
