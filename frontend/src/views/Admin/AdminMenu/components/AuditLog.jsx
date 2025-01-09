import { useCallback, useMemo, useRef, useState } from 'react'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { useTranslation } from 'react-i18next'
import { auditLogColDefs, defaultAuditLogSortModel } from './_schema'
import { apiRoutes } from '@/constants/routes'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const AuditLog = () => {
  const { t } = useTranslation(['common', 'admin'])
  const [resetGridFn, setResetGridFn] = useState(null)
  const gridRef = useRef()

  const gridOptions = {
    overlayNoRowsTemplate: t('admin:auditLogsNotFound'),
    suppressHeaderMenuButton: false,
    paginationPageSize: 20
  }

  const getRowId = useCallback((params) => {
    return params.data.auditLogId
  }, [])

  const apiEndpoint = apiRoutes.getAuditLogs

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: (data) => data.data.auditLogId
      }
    }),
    []
  )

  const handleClearFilters = useCallback(() => {
    if (resetGridFn) {
      resetGridFn()
    }
  }, [resetGridFn])

  return (
    <BCBox>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('admin:AuditLog')}
      </BCTypography>
      <BCBox mb={2}>
        <ClearFiltersButton
          onClick={handleClearFilters}
        />
      </BCBox>
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
        defaultColDef={defaultColDef}
        onSetResetGrid={(fn) => {
          setResetGridFn(() => fn) // Preserve function reference
        }}
      />
    </BCBox>
  )
}
