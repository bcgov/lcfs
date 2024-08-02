import { ROUTES } from '@/constants/routes'
import { useOrganization } from '@/hooks/useOrganization'
import { useNavigate } from 'react-router-dom'
import withRole from '@/utils/withRole'
import { useTranslation } from 'react-i18next'
import { faShareFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { roles } from '@/constants/roles'

const OrgDetailsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const { data: orgData, isLoading: orgLoading } = useOrganization()
  const navigate = useNavigate()
  return (
    <BCWidgetCard
      component="div"
      disableHover={true}
      title={t('dashboard:orgDetails.orgDetailsLabel')}
      content={
        orgLoading ? (
          <Loading message={t('dashboard:orgDetails.orgDetailsLoadingMsg')} />
        ) : (
          <>
            <Stack>
              <BCTypography variant="label" color="primary">
                {orgData?.name}
              </BCTypography>
              <BCTypography variant="body4" color="primary">
                {orgData?.orgAddress.streetAddress}
              </BCTypography>
              <BCTypography variant="body4" color="primary">
                {orgData?.orgAddress.city}{' '}
                {orgData?.orgAddress.provinceState}
              </BCTypography>
              <BCTypography variant="body4" color="primary">
                {orgData?.orgAddress.country}
              </BCTypography>
              <BCTypography variant="body4" color="primary">
                {orgData?.orgAddress.postalcodeZipcode}
              </BCTypography>
              <BCTypography mt={2} variant="body4" color="primary">
                {orgData?.phone}
              </BCTypography>
              <BCTypography variant="body4" color="primary">
                {orgData?.email}
              </BCTypography>
              <List component="div" sx={{ maxWidth: '100%' }}>
                <ListItemButton
                  component="a"
                  key="organization-users"
                  alignItems="flex-start"
                  onClick={() => navigate(ROUTES.ORGANIZATION)}
                >
                  <BCTypography
                    variant="subtitle2"
                    color="link"
                    sx={{
                      textDecoration: 'underline',
                      '&:hover': { color: 'info.main' }
                    }}
                  >
                    {t('dashboard:orgDetails.users')}
                  </BCTypography>
                </ListItemButton>
                <ListItemButton
                  component="a"
                  key="create-organization-users"
                  alignItems="flex-start"
                  onClick={() => navigate(ROUTES.ORGANIZATION_ADDUSER)}
                >
                  <BCTypography
                    variant="subtitle2"
                    color="link"
                    sx={{
                      textDecoration: 'underline',
                      '&:hover': { color: 'info.main' }
                    }}
                  >
                    {t('dashboard:orgDetails.createNewUsrLabel')}
                    <FontAwesomeIcon icon={faShareFromSquare} style={{ color: '#578260', marginLeft: 6 }} />
                  </BCTypography>
                </ListItemButton>
              </List>
            </Stack>
          </>
        )
      }
    />
  )
}

const AllowedRoles = [roles.transfers]
const OrgDetailsWidgetWithRole = withRole(OrgDetailsCard, AllowedRoles)

export default OrgDetailsWidgetWithRole