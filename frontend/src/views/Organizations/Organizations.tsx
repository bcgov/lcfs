import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import Stack from '@mui/material/Stack'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { organizationsColDefs } from './OrganizationView/_schema'
import { apiRoutes } from '@/constants/routes'
import { ROUTES } from '@/routes/routes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DownloadButton } from '@/components/DownloadButton'
import { useApiService } from '@/services/useApiService'
import { useOrganizationsList } from '@/hooks/useOrganizations'
import { roles } from '@/constants/roles'
import { Role } from '@/components/Role'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import type {
  BCGridRef,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'
import type { GetRowIdParams, GridOptions } from 'ag-grid-community'
import type { AlertSeverity } from '@/components/BCAlert/BCAlertRoot'
import type { BCGridRow } from '@/components/BCDataGrid/types'

export const Organizations = () => {
  const { t } = useTranslation(['common', 'org'])
  const gridRef = useRef<BCGridRef['current']>(null)
  const downloadButtonRef = useRef(null)
  const [gridKey] = useState('organizations-grid')

  // Pagination state
  const [paginationOptions, setPaginationOptions] =
    useState<BCPaginationOptions>({
      page: 1,
      size: 10,
      sortOrders: [{ field: 'name', direction: 'asc' }],
      filters: []
    })

  const gridOptions = useMemo<GridOptions<BCGridRow>>(
    () => ({
      overlayNoRowsTemplate: t('org:noOrgsFound')
    }),
    [t]
  )
  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: ({ data }: { data: unknown }) => {
          if (
            typeof data === 'object' &&
            data !== null &&
            'organizationId' in data
          ) {
            const { organizationId } = data
            return String(organizationId ?? '')
          }
          return ''
        }
      }
    }),
    []
  )

  const columnDefs = useMemo(() => organizationsColDefs(t), [t])

  // For alert messages
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState<AlertSeverity>('info')

  // For downloads
  const apiService = useApiService()
  const [isDownloadingOrgs, setIsDownloadingOrgs] = useState(false)
  const [isDownloadingUsers, setIsDownloadingUsers] = useState(false)

  // Use the organizations list hook
  const queryData = useOrganizationsList(paginationOptions, {})
  const gridQueryData = {
    data: queryData.data,
    isError: queryData.isError,
    isLoading: queryData.isLoading,
    error: queryData.error
  }

  // Clear filters using gridRef exposed API and reset pagination filters
  const handleClearFilters = useCallback(() => {
    setPaginationOptions((prev) => ({ ...prev, page: 1, filters: [] }))
  }, [])

  // Router navigation
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (location?.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location?.state])

  // Download handlers
  const handleDownloadOrgs = async () => {
    setIsDownloadingOrgs(true)
    setAlertMessage('')
    try {
      await apiService.download({ url: apiRoutes.organizationExport })
    } catch (error) {
      console.error('Error downloading organization information:', error)
      setAlertMessage(t('org:orgDownloadFailMsg'))
      setAlertSeverity('error')
    } finally {
      setIsDownloadingOrgs(false)
    }
  }

  const handleDownloadUsers = async () => {
    setIsDownloadingUsers(true)
    try {
      await apiService.download({ url: apiRoutes.exportUsers })
    } catch (error) {
      console.error('Error downloading user information:', error)
      setAlertMessage(t('org:userDownloadFailMsg'))
      setAlertSeverity('error')
    } finally {
      setIsDownloadingUsers(false)
    }
  }

  // Row ID
  const getRowId = useCallback(
    (params: GetRowIdParams<BCGridRow>) => String(params.data?.organizationId),
    []
  )

  return (
    <BCBox className="organizations-container" aria-label="Organizations">
      {alertMessage && (
        <BCAlert data-test="alert-box" severity={alertSeverity}>
          {alertMessage}
        </BCAlert>
      )}
      <BCTypography variant="h5" color="primary">
        {t('org:title')}
      </BCTypography>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        my={2}
      >
        <Role roles={[roles.administrator]}>
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
            }
            onClick={() => navigate(ROUTES.ORGANIZATIONS.ADD)}
          >
            <BCTypography variant="subtitle2">
              {t('org:newOrgBtn')}
            </BCTypography>
          </BCButton>
        </Role>
        <DownloadButton
          onDownload={handleDownloadOrgs}
          isDownloading={isDownloadingOrgs}
          label={t('org:orgDownloadBtn')}
          downloadLabel={`${t('org:orgDownloadBtn')}...`}
          dataTest="download-org-button"
        />
        <DownloadButton
          ref={downloadButtonRef}
          onDownload={handleDownloadUsers}
          isDownloading={isDownloadingUsers}
          label={t('org:userDownloadBtn')}
          downloadLabel={`${t('org:userDownloadBtn')}...`}
          dataTest="download-user-button"
        />
      </Stack>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey={gridKey}
          columnDefs={columnDefs}
          queryData={gridQueryData}
          dataKey="organizations"
          autoSizeStrategy={{
            type: 'fitGridWidth',
            defaultMinWidth: 50
          }}
          paginationOptions={paginationOptions}
          onPaginationChange={setPaginationOptions}
          getRowId={getRowId}
          gridOptions={gridOptions}
          enableCopyButton={false}
          defaultColDef={defaultColDef}
          onClearFilters={handleClearFilters}
        />
      </BCBox>
    </BCBox>
  )
}
