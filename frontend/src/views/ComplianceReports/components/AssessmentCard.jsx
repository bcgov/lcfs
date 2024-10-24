import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { List, ListItem, ListItemText, Stack, Typography } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { timezoneFormatter } from '@/utils/formatters'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

export const AssessmentCard = ({ orgName, hasMet, history, isGovernmentUser }) => {
  const { t } = useTranslation(['report'])
  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) {
      return []
    }
    // Sort the history array by date in descending order
    return [...history].sort((a, b) => {
      return new Date(b.createDate) - new Date(a.createDate)
    }).map(item => {
      if (item.status.status === COMPLIANCE_REPORT_STATUSES.ASSESSED && !isGovernmentUser) {
        item.status.status = "AssessedBy"
      }
      return item
    }).filter(item => item.status.status !== COMPLIANCE_REPORT_STATUSES.DRAFT)
  }, [history, isGovernmentUser])

  if (filteredHistory.length === 0) {
    return null
  }
  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content' }}
      title={t('report:assessment')}
      content={
        <Stack direction="column" spacing={0.5}>
          <Typography
            component="div"
            variant="body4"
            dangerouslySetInnerHTML={{
              __html: t('report:assessmentLn1', { name: orgName, hasMet: hasMet ? 'has met' : 'has not met' })
            }}
          />
          <Typography
            component="div"
            variant="body4"
            dangerouslySetInnerHTML={{
              __html: t('report:assessmentLn2', { name: orgName, hasMet: hasMet ? 'has met' : 'has not met' })
            }}
          />
          <Typography component="div" variant="h6" color="primary" style={{ marginTop: '1rem' }}>
            {t(`report:reportHistory`)}
          </Typography>
          <List component="div" sx={{ maxWidth: '100%', listStyleType: 'disc' }}>
            {filteredHistory.map((item, index) => (
              <ListItem key={index} disablePadding>
                <ListItemText
                  sx={{ display: 'list-item', padding: '0', marginLeft: '1.2rem', marginTop: '-0.7rem' }}
                  primary={
                    <Typography component="div" variant="body4" mt={1} key={index}
                      dangerouslySetInnerHTML={{
                        __html: t(`report:complianceReportHistory.${item.status.status}`, {
                          createDate: timezoneFormatter({ value: item?.createDate }),
                          firstName: item.userProfile.firstName,
                          lastName: item.userProfile.lastName,
                        })
                      }} />
                  } />
              </ListItem>
            ))}
          </List>
        </Stack>
      }
    />
  )
}
