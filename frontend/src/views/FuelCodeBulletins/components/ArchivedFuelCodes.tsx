import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { DownloadButton } from '@/components/DownloadButton'
import { Stack } from '@mui/material'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { govRoles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { buildColumnDefs, normalizeRows } from '../_schema'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import {
  useDownloadFuelCodeBulletins,
  useFuelCodeBulletins
} from '@/hooks/useFuelCode'
import BCAlert from '@/components/BCAlert'

const initialPaginationOptions = {
  page: 1,
  size: 25,
  sortOrders: [],
  filters: []
}

export const ArchivedFuelCodes = () => {
  const { t } = useTranslation(['bulletins'])
  const { hasAnyRole } = useCurrentUser()
  const isIdirView = hasAnyRole(...govRoles)
  const gridRef = useRef<any>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )
  const { mutateAsync: downloadBulletins } = useDownloadFuelCodeBulletins()

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

  const handleDownload = async () => {
    setIsDownloading(true)
    setDownloadError('')

    try {
      await downloadBulletins({
        bulletinType: 'archived',
        format: 'xlsx',
        body: {
          page: 1,
          size: paginationOptions.size || 25,
          sortOrders: paginationOptions.sortOrders || [],
          filters: paginationOptions.filters || []
        }
      })
    } catch (error) {
      console.error('Error downloading archived fuel code bulletin:', error)
      setDownloadError(t('common.downloadError'))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Stack spacing={2}>
      {(isError || downloadError) && (
        <BCAlert severity="error">
          {downloadError || error?.message || t('common.errorLoading')}
        </BCAlert>
      )}
      <BCTypography variant="h5" color="primary">
        {isIdirView ? t('archived.idirTitle') : t('archived.title')}
      </BCTypography>

      {!isIdirView && (
        <>
          <BCTypography variant="body2" color="text">
            {t('archived.description')}
          </BCTypography>
          <BCTypography variant="body2" color="text">
            {t('common.fuelCodePrefix')}
          </BCTypography>
        </>
      )}

      <Stack direction="row">
        <DownloadButton
          onDownload={handleDownload}
          isDownloading={isDownloading}
          label={t('common.downloadBtn')}
          downloadLabel={t('common.downloadingBtn')}
          dataTest="archived-fuel-codes-download-btn"
        />
      </Stack>

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
