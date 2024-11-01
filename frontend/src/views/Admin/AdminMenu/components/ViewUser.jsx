import { Stack, IconButton } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import Loading from '@/components/Loading'
import BCTypography from '@/components/BCTypography'
import { FloatingAlert, BCAlert2 } from '@/components/BCAlert'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { useRef, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'
import { phoneNumberFormatter } from '@/utils/formatters'
import { RoleSpanRenderer, StatusRenderer } from '@/utils/grid/cellRenderers'
import { userActivityColDefs, defaultSortModel } from '@/views/Admin/AdminMenu/components/_schema'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { roles } from '@/constants/roles'
import { useOrganizationUser } from '@/hooks/useOrganization'
import { Role } from '@/components/Role'

export const ViewUser = () => {
  const { t } = useTranslation(['common', 'admin'])
  const gridRef = useRef()
  const alertRef = useRef()
  const gridOptions = {
    overlayNoRowsTemplate: t('admin:activitiesNotFound'),
    suppressHeaderMenuButton: false,
    paginationPageSize: 20
  }

  const { userID, orgID } = useParams()
  const { data: currentUser, hasRoles } = useCurrentUser()
  const navigate = useNavigate()
  const { data, isLoading, isLoadingError, isError, error } = hasRoles(roles.supplier)
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
    useOrganizationUser(
      orgID || currentUser?.organization.organizationId,
      userID
    )
    : // eslint-disable-next-line react-hooks/rules-of-hooks
    useUser(parseInt(userID))

  const handleEditClick = () => {
    if (hasRoles(roles.supplier)) {
      navigate(ROUTES.ORGANIZATION_EDITUSER.replace(':userID', userID))
    } else if (orgID)
      navigate(
        ROUTES.ORGANIZATIONS_EDITUSER.replace(':orgID', orgID).replace(
          ':userID',
          userID
        )
      )
    else navigate(ROUTES.ADMIN_USERS_EDIT.replace(':userID', userID))
  }

  const apiEndpoint = apiRoutes.getUserActivities.replace(':userID', userID)
  const gridKey = `user-activity-grid-${userID}`

  const getRowId = useCallback((params) => {
    return `${params.data.transactionType.toLowerCase()}-${params.data.transactionId}`;
  }, []);

  const handleRowClicked = useCallback((params) => {
    const { transactionType, transactionId } = params.data;

    let route;
    switch (transactionType) {
      case 'Transfer':
        route = ROUTES.TRANSFERS_VIEW.replace(':transferId', transactionId);
        break;
      case 'AdminAdjustment':
        route = ROUTES.ADMIN_ADJUSTMENT_VIEW.replace(':transactionId', transactionId);
        break;
      case 'InitiativeAgreement':
        route = ROUTES.INITIATIVE_AGREEMENT_VIEW.replace(':transactionId', transactionId);
    }

    navigate(route);
  }, [navigate]);

  useEffect(() => {
    if (isError) {
      alertRef.current?.triggerAlert({ message: error.response?.data?.detail || error.message, severity: 'error' })
    }
  }, [isError, error])

  if (isError) {
    return <>
      <BCAlert2 ref={alertRef}
        data-test="alert-box"
        delay={10000} />
    </>
  }

  if (isLoading) return <Loading />

  return (
    <div>
      {isLoadingError ? (
        <FloatingAlert ref={alertRef} data-test="alert-box" />
      ) : (
        <>
          <BCTypography variant="h5" color="primary" mb={1}>
            {data.firstName + ' ' + data.lastName}&nbsp;
            <Role roles={[roles.administrator, roles.manage_users]}>
              <IconButton
                aria-label="edit"
                color="primary"
                onClick={handleEditClick}
              >
                <EditIcon />
              </IconButton>
            </Role>
          </BCTypography>
          <Stack direction="column" spacing={0.5} mb={2}>
            <BCTypography variant="body4">
              <strong>{t('Organization')}:</strong>&nbsp;
              {data.organization?.name || t('govOrg')}
            </BCTypography>
            <BCTypography variant="body4">
              <strong>{t('admin:Email')}:</strong>&nbsp;{data.keycloakEmail}
            </BCTypography>
            <BCTypography variant="body4">
              <strong>{t('admin:WorkPhone')}:</strong>&nbsp;
              {phoneNumberFormatter({ value: data.phone })}
            </BCTypography>
            <BCTypography variant="body4">
              <strong>{t('admin:MobilePhone')}:</strong>&nbsp;
              {phoneNumberFormatter({ value: data.mobilePhone })}
            </BCTypography>
            <BCTypography variant="body4">
              <strong>{t('Status')}:</strong>&nbsp;
              {StatusRenderer({ data, isView: true })}
            </BCTypography>
            <BCTypography variant="body4">
              <strong>{t('admin:Roles')}:</strong>&nbsp;
              {RoleSpanRenderer({ data })}
            </BCTypography>
            <BCTypography variant="body4">
              <strong>{t('admin:Title')}:</strong>&nbsp;{data.title}
            </BCTypography>
          </Stack>
            <Role roles={[roles.administrator, roles.manage_users]}>
              <BCTypography variant="h5" color="primary" mb={1}>
                {t('admin:UserActivity')}
              </BCTypography>
              <BCDataGridServer
                gridRef={gridRef}
                apiEndpoint={apiEndpoint}
                apiData="activities"
                columnDefs={userActivityColDefs}
                gridKey={gridKey}
                getRowId={getRowId}
                gridOptions={gridOptions}
                defaultSortModel={defaultSortModel}
                enableCopyButton={false}
                handleRowClicked={handleRowClicked}
              />
            </Role>
        </>
      )}
    </div>
  )
}
