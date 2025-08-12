import { useTranslation } from 'react-i18next'
import { Stack, Button } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { constructAddress } from '@/utils/constructAddress'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'

export const OrgDetailsCard = ({
  orgName,
  orgAddress,
  orgAttorneyAddress,
  organizationSnapshot,
  isGovernmentUser = false
}) => {
  const { t } = useTranslation(['report'])
  const navigate = useNavigate()

  const handleUpdateOrgInfo = () => {
    navigate(ROUTES.ORGANIZATIONS.EDIT.replace(':orgID', organizationSnapshot.organizationId), {
      state: { organizationSnapshot }
    })
  }

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
          {!isGovernmentUser && (
            <BCTypography
              component="div"
              style={{ marginTop: '2rem' }}
              variant="body4"
              dangerouslySetInnerHTML={{
                __html: t('report:contactForAddrChange')
              }}
            />
          )}
          {isGovernmentUser && organizationSnapshot?.isEdited && (
            <BCButton
              variant="outlined"
              color="primary"
              onClick={handleUpdateOrgInfo}
              style={{ marginTop: '1rem' }}
            >
              {t('report:updateOrgInfo')}
            </BCButton>
          )}
        </Stack>
      }
    />
  )
}
