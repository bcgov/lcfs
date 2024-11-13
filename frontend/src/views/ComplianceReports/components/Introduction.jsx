import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography
} from '@mui/material'
import { GlobalStyles } from '@mui/system'
import { useTranslation } from 'react-i18next'

// Reusable Section Component
const Section = ({ header, content }) => (
  <>
    <Typography
      variant="h6"
      color="primary"
      sx={{ marginY: '16px' }}
      dangerouslySetInnerHTML={{ __html: header }}
    ></Typography>
    {content.map((paragraph, index) => (
      <Typography
        key={index}
        variant="body4"
        sx={{
          '& p': {
            marginBottom: '16px'
          },
          '& p:last-child': {
            marginBottom: '8px'
          }
        }}
        dangerouslySetInnerHTML={{ __html: paragraph }}
      ></Typography>
    ))}
  </>
)

export const Introduction = ({ expanded, compliancePeriod }) => {
  const { t } = useTranslation(['report'])
  // Get sections from the translation file
  const sections = t('report:sections', { returnObjects: true, complianceYear: compliancePeriod, nextYear: parseInt(compliancePeriod) + 1 })

  return (
    <>
      <GlobalStyles
        styles={{
          ul: {
            paddingLeft: 16,
            marginLeft: 16,
            marginBottom: 16
          }
        }}
      />
      <Accordion expanded={expanded}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ width: '2rem', height: '2rem' }} />}
          aria-controls="panel1-content"
          id="compliance-report-intro"
          data-test="compliance-report-intro"
        >
          <Typography color="primary" variant="h5" component="div">
            {t('report:introduction')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Render each section using map */}
          {sections.map((section, index) => (
            <Section key={index} header={section.header} content={section.content} />
          ))}
        </AccordionDetails>
      </Accordion>
      <Typography variant="h6" color="primary" sx={{ marginY: '16px' }}>
        {t('report:questions')}
      </Typography>
      <Typography
        variant="body4"
        sx={{
          '& p': {
            marginBottom: '16px'
          },
          '& p:last-child': {
            marginBottom: '0'
          }
        }}
        dangerouslySetInnerHTML={{ __html: t('report:contact') }}
      ></Typography>
    </>
  )
}

Introduction.displayName = 'Introduction'
