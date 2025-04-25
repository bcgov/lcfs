import Loading from '@/components/Loading'
import BCTypography from '@/components/BCTypography'
import { BCAlert2, FloatingAlert } from '@/components/BCAlert'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useTranslation } from 'react-i18next'
import { phoneNumberFormatter } from '@/utils/formatters'
import {
  LinkRenderer,
  RoleSpanRenderer,
  StatusRenderer
} from '@/utils/grid/cellRenderers'
import {
  defaultSortModel,
  userActivityColDefs
} from '@/views/Admin/AdminMenu/components/_schema'
import { apiRoutes } from '@/constants/routes'
import { ROUTES, buildPath } from '@/routes/routes'
import { roles } from '@/constants/roles'
import { useOrganizationUser } from '@/hooks/useOrganization'
import { Role } from '@/components/Role'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCBox from '@/components/BCBox'

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
  const [editButtonRoute, setEditButtonRoute] = useState(null)

  const { data, isLoading, isLoadingError, isError, error } = hasRoles(
    roles.supplier
  )
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useOrganizationUser(
        orgID || currentUser?.organization.organizationId,
        userID
      )
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useUser(parseInt(userID))

  const canEdit = hasRoles(roles.administrator) || hasRoles(roles.manage_users)

  useEffect(() => {
    let route = null
    if (hasRoles(roles.supplier)) {
      route = buildPath(ROUTES.ORGANIZATION.EDIT_USER, { userID })
    } else if (orgID) {
      route = buildPath(ROUTES.ORGANIZATIONS.EDIT_USER, { orgID, userID })
    } else {
      route = buildPath(ROUTES.ADMIN.USERS.EDIT, { userID })
    }
    setEditButtonRoute(route)
  }, [hasRoles, orgID, userID])

  const apiEndpoint = apiRoutes.getUserActivities.replace(':userID', userID)
  const gridKey = `user-activity-grid-${userID}`

  const getRowId = useCallback((params) => {
    return `${params.data.transactionType.toLowerCase()}-${
      params.data.transactionId
    }`
  }, [])

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        isAbsolute: true,
        url: (data) => {
          const { transactionType, transactionId } = data.data
          switch (transactionType) {
            case 'Transfer':
              return buildPath(ROUTES.TRANSFERS.VIEW, {
                transferId: transactionId
              })
            case 'AdminAdjustment':
              return buildPath(ROUTES.TRANSACTIONS.ADMIN_ADJUSTMENT.VIEW, {
                transactionId
              })
            case 'InitiativeAgreement':
              return buildPath(ROUTES.TRANSACTIONS.INITIATIVE_AGREEMENT.VIEW, {
                transactionId
              })
          }
        }
      }
    }),
    []
  )

  useEffect(() => {
    if (isError) {
      alertRef.current?.triggerAlert({
        message: error.response?.data?.detail || error.message,
        severity: 'error'
      })
    }
  }, [isError, error])

  if (isError) {
    return (
      <>
        <BCAlert2 ref={alertRef} data-test="alert-box" delay={10000} />
      </>
    )
  }

  if (isLoading) return <Loading />

  return (
    <>
      {isLoadingError ? (
        <FloatingAlert ref={alertRef} data-test="alert-box" />
      ) : (
        <>
          <BCBox
            sx={{
              width: {
                xs: '100%',
                md: '50%'
              }
            }}
          >
            <BCWidgetCard
              id="user-card"
              title={t('admin:userDetails')}
              color="nav"
              editButton={
                canEdit
                  ? {
                      text: t('admin:editBtn'),
                      route: editButtonRoute,
                      id: 'edit-user-button'
                    }
                  : null
              }
              content={
                <BCBox p={1}>
                  <BCBox
                    display="grid"
                    gridTemplateColumns="1fr 1fr"
                    columnGap={10}
                    rowGap={2}
                  >
                    {/* Left Column */}
                    <BCBox display="flex" flexDirection="column" gap={1}>
                      <BCTypography variant="body4">
                        <strong>{t('Name')}:</strong> {data.firstName}{' '}
                        {data.lastName}
                      </BCTypography>
                      <BCTypography variant="body4">
                        <strong>{t('admin:Title')}:</strong> {data.title}
                      </BCTypography>
                      <BCTypography variant="body4">
                        <strong>{t('Organization')}:</strong>{' '}
                        {data.organization?.name || t('govOrg')}
                      </BCTypography>
                      <BCTypography variant="body4">
                        <strong>{t('Status')}:</strong>{' '}
                        {StatusRenderer({ data, isView: true })}
                      </BCTypography>
                      <BCTypography variant="body4">
                        <strong>{t('Roles')}:</strong>{' '}
                        {RoleSpanRenderer({ data })}
                      </BCTypography>
                    </BCBox>

                    {/* Right Column */}
                    <BCBox display="flex" flexDirection="column" gap={1}>
                      <BCTypography variant="body4">
                        <strong>{t('admin:Email')}:</strong>{' '}
                        {data.keycloakEmail}
                      </BCTypography>
                      <BCTypography variant="body4">
                        <strong>{t('admin:WorkPhone')}:</strong>{' '}
                        {phoneNumberFormatter({ value: data.phone })}
                      </BCTypography>
                      <BCTypography variant="body4">
                        <strong>{t('admin:MobilePhone')}:</strong>{' '}
                        {phoneNumberFormatter({ value: data.mobilePhone })}
                      </BCTypography>
                    </BCBox>
                  </BCBox>
                </BCBox>
              }
            />
          </BCBox>

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
              defaultColDef={defaultColDef}
            />
          </Role>
        </>
      )}
    </>
  )
}

export default ViewUser
