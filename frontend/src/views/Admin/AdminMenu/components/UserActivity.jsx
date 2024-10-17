import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { userActivityColDefs, defaultSortModel } from '@/views/Admin/AdminMenu/components/_schema'
import { apiRoutes, ROUTES } from '@/constants/routes'

export const UserActivity = () => {
  const { t } = useTranslation(['common', 'admin'])
  const gridRef = useRef()
  const navigate = useNavigate()

  const gridOptions = {
    overlayNoRowsTemplate: t('admin:activitiesNotFound'),
    suppressHeaderMenuButton: false,
    paginationPageSize: 20
  }

  const getRowId = useCallback((params) => {
    return `${params.data.transactionType.toLowerCase()}-${params.data.transactionId}`
  }, [])

  const apiEndpoint = apiRoutes.getAllUserActivities

  const handleRowClicked = useCallback((params) => {
    const { transactionType, transactionId } = params.data
  
    let route
    switch (transactionType) {
      case 'Transfer':
        route = ROUTES.TRANSFERS_VIEW.replace(':transferId', transactionId)
        break
      case 'AdminAdjustment':
        route = ROUTES.ADMIN_ADJUSTMENT_VIEW.replace(':transactionId', transactionId)
        break
      case 'InitiativeAgreement':
        route = ROUTES.INITIATIVE_AGREEMENT_VIEW.replace(':transactionId', transactionId)
    }

    navigate(route)
  }, [navigate])

  return (
    <BCBox>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('admin:UserActivity')}
      </BCTypography>

      <BCDataGridServer
        gridRef={gridRef}
        apiEndpoint={apiEndpoint}
        apiData="activities"
        columnDefs={userActivityColDefs}
        gridKey="all-user-activities-grid"
        getRowId={getRowId}
        gridOptions={gridOptions}
        defaultSortModel={defaultSortModel}
        enableCopyButton={false}
        handleRowClicked={handleRowClicked}
      />
    </BCBox>
  )
}
