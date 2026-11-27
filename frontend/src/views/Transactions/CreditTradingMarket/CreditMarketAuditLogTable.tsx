import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import BCBox from '@/components/BCBox'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { defaultInitialPagination } from '@/constants/schedules'
import { useCreditMarketAuditLogs } from '@/hooks/useOrganization'
import type { GetRowIdParams } from 'ag-grid-community'
import type {
  BCGridRef,
  BCGridRow,
  BCGridQueryData,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'

import { creditMarketAuditLogColDefs, defaultAuditSortModel } from './_schema'

const initialPaginationOptions = {
  ...defaultInitialPagination,
  sortOrders: defaultAuditSortModel
}

export const CreditMarketAuditLogTable = () => {
  const { t } = useTranslation(['creditMarket'])
  const gridRef: BCGridRef = useRef(null)
  const [paginationOptions, setPaginationOptions] =
    useState<BCPaginationOptions>(initialPaginationOptions)

  const auditQuery = useCreditMarketAuditLogs(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })
  const queryData: BCGridQueryData<BCGridRow> = {
    data: auditQuery.data,
    error: auditQuery.error,
    isError: auditQuery.isError,
    isLoading: auditQuery.isLoading
  }

  const auditGridProps = { defaultSortModel: defaultAuditSortModel }

  const getRowId = useCallback((params: GetRowIdParams<BCGridRow>) => {
    return String(params.data.creditMarketAuditLogId)
  }, [])

  return (
    <BCBox>
      <BCGridViewer
        gridRef={gridRef}
        queryData={queryData}
        dataKey="creditMarketAuditLogs"
        columnDefs={creditMarketAuditLogColDefs((key, fallback) =>
          fallback === undefined ? t(key) : t(key, fallback)
        )}
        gridKey="credit-market-audit-log-grid"
        getRowId={getRowId}
        {...auditGridProps}
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
