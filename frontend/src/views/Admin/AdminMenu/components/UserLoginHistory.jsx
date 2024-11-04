import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import { userLoginHistoryColDefs } from '@/views/Admin/AdminMenu/components/_schema'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useGetUserLoginHistory } from '@/hooks/useUser'

export const UserLoginHistory = () => {
  const { t } = useTranslation(['common', 'admin'])

  const getRowId = useCallback((params) => {
    return params.data.userLoginHistoryId
  }, [])

  return (
    <BCBox>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('admin:UserLoginHistory')}
      </BCTypography>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridKey={'user-login-history-grid'}
          columnDefs={userLoginHistoryColDefs(t)}
          query={useGetUserLoginHistory}
          queryParams={{ cacheTime: 0, staleTime: 0 }}
          dataKey={'histories'}
          getRowId={getRowId}
          overlayNoRowsTemplate={t('admin:historiesNotFound')}
          autoSizeStrategy={{
            defaultMinWidth: 50,
            defaultMaxWidth: 600
          }}
          rowSelection={{ isRowSelectable: false }}
        />
      </BCBox>
    </BCBox>
  )
}
