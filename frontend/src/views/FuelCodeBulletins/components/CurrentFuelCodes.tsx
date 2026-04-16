import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { Alert, Stack } from '@mui/material'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildColumnDefs, formatDate, normalizeRows } from '../_schema'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useFuelCodeBulletins } from '@/hooks/useFuelCode'
import BCAlert from '@/components/BCAlert'

const initialPaginationOptions = {
  page: 1,
  size: 25,
  sortOrders: [],
  filters: []
}

export const CurrentFuelCodes = () => {
  const { t } = useTranslation(['bulletins'])
  const gridRef = useRef<any>(null)
  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const { data, isLoading, isError, error } = useFuelCodeBulletins(
    'current',
    paginationOptions
  )

  const colDefs = useMemo(() => buildColumnDefs(t), [t])
  const queryData = useMemo(
    () => ({
      data: {
        ...data,
        fuelCodes: normalizeRows(data?.fuelCodes || [])
      },
      isLoading,
      isError,
      error
    }),
    [data, isLoading, isError, error]
  )
  const cutoffLabel = data?.cutoffDate
    ? formatDate(data.cutoffDate)
    : t('current.cutoffLabel')

  return (
    <Stack spacing={2}>
      {isError && (
        <BCAlert severity="error">
          {error?.message || t('common.errorLoading')}
        </BCAlert>
      )}

      <BCTypography variant="h5" color="primary">
        {t('current.title')}
      </BCTypography>

      <BCTypography variant="body2" color="text">
        {t('current.description', { cutoffLabel })}
      </BCTypography>
      <BCTypography variant="body2" color="text">
        {t('common.fuelCodePrefix')}
      </BCTypography>

      <BCBox sx={{ width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          queryData={queryData}
          dataKey="fuelCodes"
          columnDefs={colDefs}
          gridKey="current-fuel-codes-grid"
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
          enableMinWidthRelaxation={false}
          overlayNoRowsTemplate={t('common.noRowsFound')}
          defaultColDef={{
            floatingFilter: true,
            filter: 'agTextColumnFilter',
            filterParams: {
              filterOptions: ['contains'],
              suppressAndOrCondition: true
            },
            resizable: true,
            sortable: true
          }}
          getRowId={(params: any) => params.data.id}
        />
      </BCBox>
    </Stack>
  )
}
