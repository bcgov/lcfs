import { useTranslation } from 'react-i18next'
import { Stack } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { constructAddress } from '@/utils/constructAddress'

export const OrgDetailsCard = ({
  orgName,
  orgAddress,
  orgAttorneyAddress,
  contactName,
  isGovernmentUser = false
}) => {
  const { t } = useTranslation(['report', 'org'])
  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content', maxWidth: '25%' }}
      title={t('report:orgDetails')}
      content={
        <Stack direction="column" spacing={1}>
          <BCTypography variant="h6" color="primary">
            {orgName}
          </BCTypography>
          {contactName && (
            <div>
              <BCTypography variant="body4">
                {t('org:contactNameLabel')}:
              </BCTypography>{' '}
              <BCTypography variant="body4">{contactName}</BCTypography>
            </div>
          )}
          <div>
            <BCTypography variant="body4">
              {t('report:serviceAddrLabel')}:
            </BCTypography>{' '}
            <BCTypography variant="body4">
              {orgAddress && constructAddress(orgAddress)}
            </BCTypography>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <BCTypography variant="body4">{t('report:bcAddrLabel')}:</BCTypography>{' '}
            <BCTypography variant="body4">
              {orgAttorneyAddress && constructAddress(orgAttorneyAddress)}
            </BCTypography>
          </div>
          {!isGovernmentUser && <BCTypography
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
