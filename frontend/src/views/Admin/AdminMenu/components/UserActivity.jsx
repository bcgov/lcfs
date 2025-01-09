import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo } from 'react'
import { userActivityColDefs } from '@/views/Admin/AdminMenu/components/_schema'
import { ROUTES } from '@/constants/routes'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useGetUserActivities } from '@/hooks/useUser'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const UserActivity = () => {
  const { t } = useTranslation(['common', 'admin'])

  const getRowId = useCallback((params) => {
    return `${
      params.data.actionTaken
    }-${params.data.transactionType}-${params.data.transactionId}`
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
              return ROUTES.TRANSFERS_VIEW.replace(':transferId', transactionId)
            case 'AdminAdjustment':
              return ROUTES.ADMIN_ADJUSTMENT_VIEW.replace(
                ':transactionId',
                transactionId
              )
            case 'InitiativeAgreement':
              return ROUTES.INITIATIVE_AGREEMENT_VIEW.replace(
                ':transactionId',
                transactionId
              )
          }
        }
      }
    }),
    []
  )

  return (
    <BCBox>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('admin:UserActivity')}
      </BCTypography>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey={'all-user-activities-grid'}
          columnDefs={userActivityColDefs}
          query={useGetUserActivities}
          queryParams={{ cacheTime: 0, staleTime: 0 }}
          dataKey={'activities'}
          getRowId={getRowId}
          overlayNoRowsTemplate={t('admin:activitiesNotFound')}
          autoSizeStrategy={{
            type: 'fitGridWidth',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          defaultColDef={defaultColDef}
        />
      </BCBox>
    </BCBox>
  )
}
