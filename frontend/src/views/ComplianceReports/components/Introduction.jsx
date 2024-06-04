import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'

export const Introduction = ({ expanded, handleChange }) => {
  const { t } = useTranslation()
  return (
    <>
      <Accordion expanded={expanded} onChange={handleChange()}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1-content"
          id="compliance-report-intro"
          data-test="compliance-report-intro"
        >
          <Typography color="primary" variant="h6">
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