import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useRef, useState } from 'react'
import { userActivityColDefs } from '@/views/Admin/AdminMenu/components/_schema'
import { ROUTES } from '@/constants/routes'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { useGetUserActivities } from '@/hooks/useUser'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { BCGridViewer2 } from '@/components/BCDataGrid/BCGridViewer2.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'

export const UserActivity = () => {
  const { t } = useTranslation(['common', 'admin'])
  const [resetGridFn, setResetGridFn] = useState(null)
  const gridRef = useRef(null)

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const queryData = useGetUserActivities(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })

  const getRowId = useCallback((params) => {
    return `${params.data.actionTaken}-${params.data.transactionType}-${params.data.transactionId}`
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
                transactionId: transactionId
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

  const handleSetResetGrid = useCallback((fn) => {
    setResetGridFn(() => fn)
  }, [])

  const handleClearFilters = useCallback(() => {
    if (resetGridFn) {
      resetGridFn()
    }
  }, [resetGridFn])

  return (
    <BCBox>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('admin:UserActivity')}
      </BCTypography>
      <BCBox mb={2}>
        <ClearFiltersButton onClick={handleClearFilters} />
      </BCBox>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer2
          gridRef={gridRef}
          gridKey="all-user-activities-grid"
          columnDefs={userActivityColDefs}
          queryData={queryData}
          dataKey="activities"
          getRowId={getRowId}
          overlayNoRowsTemplate={t('admin:activitiesNotFound')}
          autoSizeStrategy={{
            type: 'fitGridWidth',
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          defaultColDef={defaultColDef}
          onSetResetGrid={handleSetResetGrid}
          initialPaginationOptions={defaultInitialPagination}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
        />
      </BCBox>
    </BCBox>
  )
}
