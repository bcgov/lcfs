import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'

export const AssessmentCard = ({ orgName, assessedDate="2025-06-25 9:44 am PST" }) => {
  const { t } = useTranslation(['report'])
  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content' }}
      title={t('report:assessment')}
      content={
        <Stack direction="column" spacing={1}>
          <Typography
            component="div"
            variant="body4"
            dangerouslySetInnerHTML={{
              __html: t('report:assessmentLn1', {name: orgName})
            }}
          />
          <Typography
            component="div"
            variant="body4"
            dangerouslySetInnerHTML={{
              __html: t('report:assessmentLn2', {name: orgName})
            }}
          />
          <Typography
            component="div"
            variant="body4"
            dangerouslySetInnerHTML={{
              __html: t('report:assessmentLn3', {assessedDate})
            }}
          />
        </Stack>
      }
    />
  )
}
