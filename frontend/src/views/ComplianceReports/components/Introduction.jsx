import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { GlobalStyles } from '@mui/system'
import { useTranslation, Trans } from 'react-i18next'
import { ExpandMore } from '@mui/icons-material'

// Reusable Section Component
const Section = ({ header, content }) => (
  <>
    <BCTypography variant="h6" color="primary" sx={{ marginY: '16px' }}>
      {header}
    </BCTypography>
    {content.map((paragraph, index) => (
      <BCTypography
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
      >
        <Trans
          i18nKey={paragraph}
          components={{
            p: <p />,
            strong: <strong />,
            ul: <ul />,
            li: <li />,
            br: <br />,
            a: <a />
          }}
        />
      </BCTypography>
    ))}
  </>
)

export const Introduction = ({
  expanded,
  compliancePeriod,
  isEarlyIssuance
}) => {
  const { t } = useTranslation(['report'])

  // Get sections from the translation file
  const sections = t(
    isEarlyIssuance ? 'report:earlyIssuanceIntroSections' : 'report:sections',
    {
      returnObjects: true,
      complianceYear: compliancePeriod,
      nextYear: parseInt(compliancePeriod) + 1
    }
  )

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
          expandIcon={<ExpandMore sx={{ width: '2rem', height: '2rem' }} />}
          aria-controls="panel1-content"
          id="compliance-report-intro"
          data-test="compliance-report-intro"
        >
          <BCTypography color="primary" variant="h6" component="div">
            {t('report:introduction')}
          </BCTypography>
        </AccordionSummary>
        <AccordionDetails data-test="intro-details">
          {/* Render each section using map */}
          {sections.map((section, index) => (
            <Section
              key={index}
              header={section.header}
              content={section.content}
            />
          ))}
        </AccordionDetails>
      </Accordion>
      <BCTypography variant="h6" color="primary" sx={{ marginY: '16px' }}>
        {t('report:questions')}
      </BCTypography>
      <BCTypography
        variant="body4"
        sx={{
          '& p': {
            marginBottom: '16px'
          },
          '& p:last-child': {
            marginBottom: '0'
          }
        }}
      >
        <Trans
          i18nKey="report:contact"
          components={{
            p: <p />,
            strong: <strong />,
            a: <a />,
            br: <br />
          }}
        />
      </BCTypography>
    </>
  )
}

Introduction.displayName = 'Introduction'
