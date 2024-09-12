import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { timezoneFormatter } from '@/utils/formatters'
import BCBox from '@/components/BCBox'

export const ReportHistoryCard = ({ history }) => {
  const { t } = useTranslation(['report'])
  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content' }}
      title={t('report:reportHistory')}
      content={
        <Stack direction="column" spacing={1}>
          {history?.filter(item => item.status.status !== 'Draft').map((item, index) => (
            <BCBox key={index}>
              <Typography component="div" variant="h6" color="primary">
                {t(`report:complianceReportHistory.${item.status.status}Title`)}
              </Typography>
              <Typography component="div" variant="body4" mt={1}>
                {t(`report:complianceReportHistory.${item.status.status}`, {
                  createDate: timezoneFormatter({ value: item?.createDate }),
                  firstName: item.userProfile.firstName,
                  lastName: item.userProfile.lastName,
                })}
              </Typography>
            </BCBox>
          ))}
        </Stack>
      }
    />
  )
}
