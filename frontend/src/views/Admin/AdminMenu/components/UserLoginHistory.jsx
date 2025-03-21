import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useCallback, useState } from 'react'
import { userLoginHistoryColDefs } from '@/views/Admin/AdminMenu/components/_schema'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { useGetUserLoginHistory } from '@/hooks/useUser'
import { BCGridViewer2 } from '@/components/BCDataGrid/BCGridViewer2.jsx'
import { defaultInitialPagination } from '@/constants/schedules.js'

export const UserLoginHistory = () => {
  const { t } = useTranslation(['common', 'admin'])
  const [resetGridFn, setResetGridFn] = useState(null)

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
        {t('admin:UserLoginHistory')}
      </BCTypography>
      <BCBox mb={2}>
        <ClearFiltersButton onClick={handleClearFilters} />
      </BCBox>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer2
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
