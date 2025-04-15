import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { useTranslation } from 'react-i18next'
import { ActivityLinksList } from './ActivityLinksList'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Box from '@mui/material/Box'

export const ActivityListCard = ({
  name,
  period,
  currentStatus,
  quarter='',
  isQuarterlyReport=false
}) => {
  const { t } = useTranslation(['report'])

  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content' }}
      title={t('report:reportActivities')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        <BCBox
          sx={{
            marginTop: '5px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          <BCTypography
            variant="body4"
            color="text"
            component="div"
            dangerouslySetInnerHTML={{
              __html: isQuarterlyReport
                ? t('report:quarterlyActivityHdrLabel', { quarter })
                : t('report:activityHdrLabel', { name, period })
            }}
          />
          <Box>
            <ActivityLinksList
              currentStatus={currentStatus}
              isQuarterlyReport={isQuarterlyReport}
            />
          </Box>
        </BCBox>
      }
    />
  )
}
