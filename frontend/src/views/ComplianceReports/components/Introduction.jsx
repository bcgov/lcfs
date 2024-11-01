import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography
} from '@mui/material'
import { GlobalStyles } from '@mui/system'
import { useTranslation } from 'react-i18next'

export const Introduction = ({ expanded }) => {
  const { t } = useTranslation()
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
          <Typography
            color="primary"
            variant="h6"
            sx={{ marginBottom: '16px' }}
          >
            {t('report:introH1')}
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
            dangerouslySetInnerHTML={{ __html: t('report:introH1Details') }}
          ></Typography>
          <Typography variant="h6" color="primary" sx={{ marginY: '16px' }}>
            {t('report:introH2')}
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
            dangerouslySetInnerHTML={{ __html: t('report:introH2Details') }}
          ></Typography>
          <Typography variant="h6" color="primary" sx={{ marginY: '16px' }}>
            {t('report:introH3')}
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
            dangerouslySetInnerHTML={{ __html: t('report:introH3Details') }}
          ></Typography>
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
