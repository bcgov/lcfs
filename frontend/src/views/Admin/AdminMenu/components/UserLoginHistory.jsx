import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useCallback, useRef, useState } from 'react'
import { userLoginHistoryColDefs } from '@/views/Admin/AdminMenu/components/_schema'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { useGetUserLoginHistory } from '@/hooks/useUser'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'

export const UserLoginHistory = () => {
  const { t } = useTranslation(['common', 'admin'])
  const gridRef = useRef(null)

  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )
  const queryData = useGetUserLoginHistory(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })

  const getRowId = useCallback((params) => {
    return params.data.userLoginHistoryId.toString()
  }, [])

  const handleClearFilters = () => {
    setPaginationOptions(defaultInitialPagination)
    if (gridRef && gridRef.current) {
      gridRef.current.clearFilters()
    }
  }

  return (
    <BCBox>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('admin:UserLoginHistory')}
      </BCTypography>
      <BCBox mb={2}>
        <ClearFiltersButton onClick={handleClearFilters} />
      </BCBox>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="user-login-history-grid"
          columnDefs={userLoginHistoryColDefs(t)}
          queryData={queryData}
          dataKey="histories"
          getRowId={getRowId}
          overlayNoRowsTemplate={t('admin:historiesNotFound')}
          autoSizeStrategy={{
            defaultMinWidth: 50,
            defaultMaxWidth: 600,
            type: 'fitGridWidth'
          }}
          paginationOptions={paginationOptions}
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
