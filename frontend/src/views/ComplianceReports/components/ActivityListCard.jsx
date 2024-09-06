import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { useTranslation } from 'react-i18next'
import { ActivityLinksList } from './ActivityLinkList'
import { Typography } from '@mui/material'
import BCBox from '@/components/BCBox'

export const ActivityListCard = ({ name, period }) => {
  const { t } = useTranslation()

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
          <Typography
            variant="body4"
            color="text"
            component="div"
            dangerouslySetInnerHTML={{
              __html: t('report:activityHdrLabel', { name, period })
            }}
          />
          <Typography variant="body4" color="text" component="div">
            {t('report:activityLinksList')}:
          </Typography>
          <ActivityLinksList />
        </BCBox>
      }
    />
  )
}
