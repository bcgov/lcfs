import { useRef, useCallback } from 'react'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { auditLogColDefs, defaultAuditLogSortModel } from './_schema'
import { apiRoutes, ROUTES } from '@/constants/routes'
import { useNavigate } from 'react-router-dom'

export const AuditLog = () => {
  const { t } = useTranslation(['common', 'admin'])
  const gridRef = useRef()
  const navigate = useNavigate()

  const gridOptions = {
    overlayNoRowsTemplate: t('admin:auditLogsNotFound'),
    suppressHeaderMenuButton: false,
    paginationPageSize: 20
  }

  const getRowId = useCallback((params) => {
    return params.data.auditLogId
  }, [])

  const apiEndpoint = apiRoutes.getAuditLogs

  const handleRowClicked = useCallback(
    (params) => {
      const { auditLogId } = params.data
      const path = ROUTES.ADMIN_AUDIT_LOG_VIEW.replace(
        ':auditLogId',
        auditLogId
      )
      navigate(path)
    },
    [navigate]
  )

  return (
    <BCBox>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('admin:AuditLog')}
      </BCTypography>

      <BCDataGridServer
        gridRef={gridRef}
        apiEndpoint={apiEndpoint}
        apiData="auditLogs"
        columnDefs={auditLogColDefs(t)}
        gridKey="audit-log-grid"
        getRowId={getRowId}
        gridOptions={gridOptions}
        defaultSortModel={defaultAuditLogSortModel}
        enableCopyButton={false}
        enableExportButton={true}
        exportName="AuditLog"
        handleRowClicked={handleRowClicked}
      />
    </BCBox>
  )
}
