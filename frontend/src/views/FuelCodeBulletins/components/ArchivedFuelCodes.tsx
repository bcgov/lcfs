import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { Stack } from '@mui/material'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildColumnDefs, normalizeRows } from '../_schema'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { useFuelCodeBulletins } from '@/hooks/useFuelCode'
import BCAlert from '@/components/BCAlert'

const initialPaginationOptions = {
  page: 1,
  size: 25,
  sortOrders: [],
  filters: []
}

export const ArchivedFuelCodes = () => {
  const { t } = useTranslation(['bulletins'])
  const gridRef = useRef<any>(null)
  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const { data, isLoading, isError, error } = useFuelCodeBulletins(
    'archived',
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

  return (
    <Stack spacing={2}>
      {isError && (
        <BCAlert severity="error">
          {error?.message || t('common.errorLoading')}
        </BCAlert>
      )}
      <BCTypography variant="h5" color="primary">
        {t('archived.title')}
      </BCTypography>

      <BCTypography variant="body2" color="text">
        {t('archived.description')}
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
          gridKey="archived-fuel-codes-grid"
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
