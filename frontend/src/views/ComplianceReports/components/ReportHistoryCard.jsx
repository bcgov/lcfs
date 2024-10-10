import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { timezoneFormatter } from '@/utils/formatters'
import BCBox from '@/components/BCBox'

export const ReportHistoryCard = ({ history, isGovernmentUser, currentStatus }) => {
  const { t } = useTranslation(['report'])

  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) {
      return []
    }

    if (isGovernmentUser) {
      // Government users: Show all statuses except 'Draft'
      return history.filter((item) => item.status.status !== 'Draft')
    } else {
      // Non-government users
      if (['Submitted', 'Assessed', 'ReAssessed'].includes(currentStatus)) {
        // If report is 'Assessed' or 'ReAssessed', display only 'Submitted' status
        return history.filter((item) => item.status.status === 'Submitted')
      } else {
        // Otherwise, do not display any history
        return []
      }
    }
  }, [history, isGovernmentUser, currentStatus])

  if (filteredHistory.length === 0) {
    return null
  }

  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content' }}
      title={t('report:reportHistory')}
      content={
        <Stack direction="column" spacing={1}>
          {filteredHistory.map((item, index) => (
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
