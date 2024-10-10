import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { constructAddress } from '@/utils/constructAddress'

export const OrgDetailsCard = ({ orgName, orgAddress, orgAttorneyAddress, isGovernmentUser = false }) => {
  const { t } = useTranslation(['report'])
  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content', maxWidth: '25%' }}
      title={t('report:orgDetails')}
      content={
        <Stack direction="column" spacing={1}>
          <Typography variant="h6" color="primary">
            {orgName}
          </Typography>
          <div>
            <Typography variant="body4">
              {t('report:serviceAddrLabel')}:
            </Typography>{' '}
            <Typography variant="body4">
              {constructAddress(orgAddress)}
            </Typography>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <Typography variant="body4">{t('report:bcAddrLabel')}:</Typography>{' '}
            <Typography variant="body4">
              {constructAddress(orgAttorneyAddress)}
            </Typography>
          </div>
          {!isGovernmentUser && <Typography
            component="div"
            style={{ marginTop: '2rem' }}
            variant="body4"
            dangerouslySetInnerHTML={{
              __html: t('report:contactForAddrChange')
            }}
          />}
        </Stack>
      }
    />
  )
}
