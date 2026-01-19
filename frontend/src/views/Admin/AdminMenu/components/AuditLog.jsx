import { useCallback, useMemo, useRef, useState } from 'react'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { auditLogColDefs, defaultAuditLogSortModel } from './_schema'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { defaultInitialPagination } from '@/constants/schedules'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { useAuditLogs } from '@/hooks/useAuditLog.js'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultAuditLogSortModel,
  filters: []
}

export const AuditLog = () => {
  const { t } = useTranslation(['common', 'admin'])
  const gridRef = useRef()

  const gridOptions = {
    overlayNoRowsTemplate: t('admin:auditLogsNotFound'),
    suppressHeaderMenuButton: false,
    paginationPageSize: 20
  }

  const getRowId = useCallback((params) => {
    return params.data.auditLogId.toString()
  }, [])

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const queryData = useAuditLogs(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: (data) => data.data.auditLogId
      }
    }),
    []
  )

  const handleClearFilters = () => {
    setPaginationOptions(initialPaginationOptions)
    if (gridRef && gridRef.current) {
      gridRef.current.clearFilters()
    }
  }

  return (
    <BCBox>
      <BCTypography variant="h5" color="primary" mb={2}>
        {t('admin:AuditLog')}
      </BCTypography>
      <BCGridViewer
        gridRef={gridRef}
        queryData={queryData}
        dataKey="auditLogs"
        columnDefs={auditLogColDefs(t)}
        gridKey="audit-log-grid"
        getRowId={getRowId}
        gridOptions={gridOptions}
        defaultSortModel={defaultAuditLogSortModel}
        enableCopyButton={false}
        enableExportButton={true}
        exportName="AuditLog"
        autoSizeStrategy={{
          type: 'fitGridWidth',
          defaultMinWidth: 50,
          defaultMaxWidth: 600
        }}
        defaultColDef={defaultColDef}
        paginationOptions={paginationOptions}
        onPaginationChange={(newPagination) =>
          setPaginationOptions((prev) => ({
            ...prev,
            ...newPagination
          }))
        }
      />
    </BCBox>
  )
}
