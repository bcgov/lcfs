import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { userActivityColDefs } from '@/views/Admin/AdminMenu/components/_schema'
import { ROUTES } from '@/constants/routes'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useGetUserActivities } from '@/hooks/useUser'

export const UserActivity = () => {
  const { t } = useTranslation(['common', 'admin'])
  const navigate = useNavigate()

  const getRowId = useCallback((params) => {
    return `${params.data.transactionType.toLowerCase()}-${
      params.data.transactionId
    }`
  }, [])

  const handleRowClicked = useCallback(
    (params) => {
      const { transactionType, transactionId } = params.data

      let route
      switch (transactionType) {
        case 'Transfer':
          route = ROUTES.TRANSFERS_VIEW.replace(':transferId', transactionId)
          break
        case 'AdminAdjustment':
          route = ROUTES.ADMIN_ADJUSTMENT_VIEW.replace(
            ':transactionId',
            transactionId
          )
          break
        case 'InitiativeAgreement':
          route = ROUTES.INITIATIVE_AGREEMENT_VIEW.replace(
            ':transactionId',
            transactionId
          )
      }

      navigate(route)
    },
    [navigate]
  )

  return (
    <BCBox>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('admin:UserActivity')}
      </BCTypography>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey={'all-user-activities-grid'}
          columnDefs={userActivityColDefs(t)}
          query={useGetUserActivities}
          queryParams={{ cacheTime: 0, staleTime: 0 }}
          dataKey={'activities'}
          getRowId={getRowId}
          overlayNoRowsTemplate={t('admin:activitiesNotFound')}
          autoSizeStrategy={{
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          rowSelection={{ isRowSelectable: false }}
          onRowClicked={handleRowClicked}
        />
      </BCBox>
    </BCBox>
  )
}
