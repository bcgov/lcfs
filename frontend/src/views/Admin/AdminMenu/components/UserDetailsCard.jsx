import Loading from '@/components/Loading'
import BCTypography from '@/components/BCTypography'
import { BCAlert2, FloatingAlert } from '@/components/BCAlert'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { UserProfile } from './UserProfile'
import { AddEditUser } from '@/views/Users'

export const UserDetailsCard = ({ addMode = false, userType = 'idir' }) => {
  const { t } = useTranslation(['common', 'admin'])
  const [isEditMode, setIsEditMode] = useState(addMode)
  const gridRef = useRef()
  const alertRef = useRef()

  const gridOptions = {
    overlayNoRowsTemplate: t('admin:activitiesNotFound'),
    suppressHeaderMenuButton: false,
    paginationPageSize: 20
  }

  const { userID, orgID } = useParams()
  const navigate = useNavigate()
  const { data: currentUser, hasRoles } = useCurrentUser()

  const { data, isLoading, isLoadingError, isError, error, refetch } = hasRoles(
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
  const apiEndpoint = apiRoutes.getUserActivities.replace(':userID', userID)
  const gridKey = `user-activity-grid-${userID}`

  const getRowId = useCallback((params) => {
    return `${params.data.transactionType.toLowerCase()}-${
      params.data.transactionId
    }`
  }, [])

  const orgName = useMemo(() => {
    if (!data?.isGovernmentUser) {
      return data?.organization?.name
    }
    return null
  }, [data])

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

  const handleEditClick = useCallback(() => {
    setIsEditMode(true)
  }, [])

  const handleNavigation = () => {
    const statusMessage = {
      state: {
        message: t('admin:createSuccessMessage'),
        severity: 'success'
      }
    }
    if (hasRoles(roles.supplier)) {
      navigate(ROUTES.ORGANIZATION.ORG, statusMessage)
    } else if (orgID) {
      navigate(buildPath(ROUTES.ORGANIZATIONS.VIEW, { orgID }), statusMessage)
    } else {
      navigate(ROUTES.ADMIN.USERS.LIST, statusMessage)
    }
  }
  const handleCancelEdit = useCallback(() => {
    if (addMode) {
      handleNavigation()
    } else {
      setIsEditMode(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const handleSaveSuccess = useCallback(() => {
    if (addMode) {
      handleNavigation()
    } else {
      alertRef.current?.triggerAlert({
        message: t('admin:editSuccessMessage'),
        severity: 'success'
      })
      setIsEditMode(false)
      refetch()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

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
      <FloatingAlert ref={alertRef} data-test="alert-box" />
      <BCBox
        sx={{
          width: '100%',
          maxWidth: {
            xs: '100%',
            md: isEditMode ? '100%' : '50%'
          }
        }}
      >
        <BCWidgetCard
          id="user-card"
          title={
            isEditMode
              ? userID
                ? `Edit user ${orgID ? 'to ' + orgName : ''}`
                : 'Add user'
              : t('admin:userDetails')
          }
          color="nav"
          editButton={
            canEdit && !isEditMode
              ? {
                  text: t('admin:editBtn'),
                  onClick: handleEditClick,
                  id: 'edit-user-button'
                }
              : null
          }
          content={
            isEditMode ? (
              <AddEditUser
                handleSaveSuccess={handleSaveSuccess}
                handleCancelEdit={handleCancelEdit}
                userType={userType}
              />
            ) : (
              <UserProfile data={data} />
            )
          }
        />
      </BCBox>
      {!addMode && (
        <Role roles={[roles.administrator, roles.manage_users]}>
          <BCTypography variant="h5" color="primary" mb={1}>
            {t('admin:UserActivity')}
          </BCTypography>
          <BCBox sx={{ overflowX: 'auto' }}>
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
          </BCBox>
        </Role>
      )}
    </>
  )
}

export default UserDetailsCard
