import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCAlert from '@/components/BCAlert'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import Loading from '@/components/Loading'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRoutes, ROUTES } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useOrganization,
  useOrganizationBalance
} from '@/hooks/useOrganization'
import { constructAddress } from '@/utils/constructAddress'
import { phoneNumberFormatter } from '@/utils/formatters'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { defaultSortModel, getUserColumnDefs } from './_schema'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const ViewOrganization = () => {
  const { t } = useTranslation(['common', 'org'])
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const navigate = useNavigate()
  const location = useLocation()
  const { orgID } = useParams()
  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    hasRoles
  } = useCurrentUser()
  const { data: orgData, isLoading } = useOrganization(
    orgID ?? currentUser?.organization?.organizationId
  )

  const { data: orgBalanceInfo } = useOrganizationBalance(
    orgID ?? currentUser?.organization?.organizationId
  )

  const canEdit = hasRoles(roles.administrator)
  const editButtonRoute = canEdit
    ? ROUTES.ORGANIZATIONS_EDIT.replace(
        ':orgID',
        orgID || currentUser?.organization?.organizationId
      )
    : null

  const [gridKey, setGridKey] = useState(`users-grid-${orgID}-active`)
  const handleGridKey = useCallback(() => {
    setGridKey(`users-grid-${orgID}`)
  }, [orgID])

  const gridOptions = {
    overlayNoRowsTemplate: 'No users found',
    includeHiddenColumnsInQuickFilter: true
  }

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        isAbsolute: true,
        url: (
          data // Based on the user Type (BCeID or IDIR) navigate to specific view
        ) =>
          hasRoles(roles.supplier)
            ? ROUTES.ORGANIZATION_VIEWUSER.replace(
                ':userID',
                data.data.userProfileId
              )
            : ROUTES.ORGANIZATIONS_VIEWUSER.replace(':orgID', orgID).replace(
                ':userID',
                data.data.userProfileId
              )
      }
    }),
    [hasRoles, orgID]
  )

  const getRowId = useCallback((params) => params.data.userProfileId, [])

  const gridRef = useRef()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  if (isLoading) {
    return <Loading />
  }

  return (
    <>
      {alertMessage && (
        <BCAlert data-test="alert-box" severity={alertSeverity}>
          {alertMessage}
        </BCAlert>
      )}
      <BCBox
        sx={{
          width: {
            md: '100%',
            lg: '75%'
          }
        }}
      >
        <BCWidgetCard
          title={t('org:orgDetails')}
          color="nav"
          editButton={{
            text: canEdit ? t('org:editBtn') : null,
            route: editButtonRoute,
            id: 'edit-org-button'
          }}
          content={
            <BCBox p={1}>
              <BCBox
                display="grid"
                gridTemplateColumns="1fr 1fr"
                columnGap={10}
                rowGap={2}
              >
                {/* Left Column */}
                <BCBox display="flex" flexDirection="column" gap={2}>
                  <BCTypography variant="body4">
                    <strong>{t('org:legalNameLabel')}:</strong> {orgData?.name}
                  </BCTypography>

                  <BCTypography variant="body4">
                    <strong>{t('org:operatingNameLabel')}:</strong>{' '}
                    {orgData?.operatingName || orgData?.name}
                  </BCTypography>

                  <BCTypography variant="body4">
                    <strong>{t('org:phoneNbrLabel')}:</strong>{' '}
                    {phoneNumberFormatter({ value: orgData?.phone })}
                  </BCTypography>

                  <BCTypography variant="body4">
                    <strong>{t('org:emailAddrLabel')}:</strong> {orgData?.email}
                  </BCTypography>

                  <Role roles={[roles.government]}>
                    <BCTypography variant="body4">
                      <strong>{t('org:complianceUnitBalance')}:</strong>{' '}
                      {orgBalanceInfo?.totalBalance?.toLocaleString()} (
                      {Math.abs(
                        orgBalanceInfo?.reservedBalance || 0
                      ).toLocaleString()}
                      )
                    </BCTypography>
                  </Role>
                </BCBox>

                {/* Right Column */}
                <BCBox display="flex" flexDirection="column" gap={2}>
                  <BCTypography variant="body4">
                    <strong>{t('org:serviceAddrLabel')}:</strong>{' '}
                    {orgData && constructAddress(orgData?.orgAddress)}
                  </BCTypography>

                  <BCTypography variant="body4">
                    <strong>{t('org:bcAddrLabel')}:</strong>{' '}
                    {orgData && constructAddress(orgData?.orgAttorneyAddress)}
                  </BCTypography>

                  <BCTypography variant="body4">
                    <strong>{t('org:regTrnLabel')}:</strong>{' '}
                    {orgData?.orgStatus.status ===
                    ORGANIZATION_STATUSES.REGISTERED
                      ? 'Yes — A registered organization is able to transfer compliance units.'
                      : 'No — An organization must be registered to transfer compliance units.'}
                  </BCTypography>
                </BCBox>
              </BCBox>

              {!isCurrentUserLoading && !hasRoles(roles.government) && (
                <BCBox mt={2}>
                  <BCTypography variant="body4">
                    Email{' '}
                    <a href={`mailto:${t('lcfsEmail')}`}>{t('lcfsEmail')}</a>{' '}
                    {t('org:toUpdateMsg')}
                  </BCTypography>
                </BCBox>
              )}
            </BCBox>
          }
        />
      </BCBox>
      <BCBox
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          textTransform: 'none'
        }}
        my={2}
      >
        <BCBox component="div">
          <Role roles={[roles.administrator, roles.manage_users]}>
            <BCButton
              variant="contained"
              size="small"
              color="primary"
              sx={{
                textTransform: 'none',
                marginRight: '8px',
                marginBottom: '8px'
              }}
              startIcon={
                <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
              }
              onClick={() =>
                !isCurrentUserLoading && hasRoles(roles.government)
                  ? navigate(
                      ROUTES.ORGANIZATIONS_ADDUSER.replace(':orgID', orgID)
                    )
                  : navigate(ROUTES.ORGANIZATION_ADDUSER)
              }
            >
              <BCTypography variant="button">{t('org:newUsrBtn')}</BCTypography>
            </BCButton>
          </Role>
        </BCBox>
        <BCTypography
          variant="h5"
          mt={1}
          color="primary"
          data-test="active-users-heading"
        >
          {t('org:usersLabel')}
        </BCTypography>
      </BCBox>
      <BCBox sx={{ height: '100%', width: '100%' }}>
        <BCDataGridServer
          gridRef={gridRef}
          apiEndpoint={apiRoutes.orgUsers.replace(
            ':orgID',
            orgID || currentUser?.organization?.organizationId
          )}
          apiData="users"
          columnDefs={getUserColumnDefs(t)}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          defaultSortModel={defaultSortModel}
          handleGridKey={handleGridKey}
          defaultColDef={defaultColDef}
          enableCopyButton={false}
          enableResetButton={false}
        />
      </BCBox>
    </>
  )
}

export default ViewOrganization
