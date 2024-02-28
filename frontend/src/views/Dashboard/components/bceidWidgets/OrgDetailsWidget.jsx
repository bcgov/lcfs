// hooks
import { ROUTES } from '@/constants/routes'
import { useOrganization } from '@/hooks/useOrganization'
import { useNavigate } from 'react-router-dom'
import withRole from '@/utils/withRole'
import { useTranslation } from 'react-i18next'
// mui components
import { faShareFromSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Stack, List, ListItemButton } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { roles } from '@/constants/roles'

export const OrgDetailsWidget = () => {
  const { t } = useTranslation(['common', 'org'])
  const { data: orgData, isLoading: orgLoading } = useOrganization()
  const navigate = useNavigate()
  return (
    <BCWidgetCard
      component="div"
      title={t('org:orgDetailsLabel')}
      content={
        orgLoading ? (
          <Loading message={t('org:orgDetailsLoadingMsg')} />
        ) : (
          <>
            <Stack>
              <BCTypography variant="label" color="primary">
                {orgData?.name}
              </BCTypography>
              <BCTypography variant="body4" color="primary">
                {orgData?.org_address.street_address}
              </BCTypography>
              <BCTypography variant="body4" color="primary">
                {orgData?.org_address.city}{' '}
                {orgData?.org_address.province_state}
              </BCTypography>
              <BCTypography variant="body4" color="primary">
                {orgData?.org_address.country}
              </BCTypography>
              <BCTypography variant="body4" color="primary">
                {orgData?.org_address.postalCode_zipCode}
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
                    {t('Users')}
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
                    {t('org:createNewUsrLabel')}&nbsp;
                    <FontAwesomeIcon icon={faShareFromSquare} />
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
const OrgDetailsWidgetWithRole = withRole(OrgDetailsWidget, AllowedRoles)

export default OrgDetailsWidgetWithRole
