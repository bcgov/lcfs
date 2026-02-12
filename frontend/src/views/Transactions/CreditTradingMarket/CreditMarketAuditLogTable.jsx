import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { defaultInitialPagination } from '@/constants/schedules'
import { useCreditMarketAuditLogs } from '@/hooks/useOrganization'

import {
  creditMarketAuditLogColDefs,
  defaultAuditSortModel
} from './_schema'

const initialPaginationOptions = {
  ...defaultInitialPagination,
  sortOrders: defaultAuditSortModel
}

export const CreditMarketAuditLogTable = () => {
  const { t } = useTranslation(['creditMarket'])
  const gridRef = useRef(null)
  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const queryData = useCreditMarketAuditLogs(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })

  const getRowId = useCallback((params) => {
    return params.data.creditMarketAuditLogId.toString()
  }, [])

  return (
    <BCBox>
      <BCGridViewer
        gridRef={gridRef}
        queryData={queryData}
        dataKey="creditMarketAuditLogs"
        columnDefs={creditMarketAuditLogColDefs(t)}
        gridKey="credit-market-audit-log-grid"
        getRowId={getRowId}
        defaultSortModel={defaultAuditSortModel}
        overlayNoRowsTemplate={t(
          'creditMarket:noAuditLogsFound',
          'No audit log entries found'
        )}
        enableCopyButton={false}
        enableExportButton={false}
        exportName="CreditMarketAuditLog"
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
