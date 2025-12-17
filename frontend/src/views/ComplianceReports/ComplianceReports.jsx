import { Stack } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES, buildPath } from '@/routes/routes'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useCreateComplianceReport,
  useGetComplianceReportList
} from '@/hooks/useComplianceReports'
import { reportsColDefs, defaultSortModel } from './components/_schema'
import { NewComplianceReportButton } from './components/NewComplianceReportButton'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules'
import BCButton from '@/components/BCButton'
import { CalculateOutlined } from '@mui/icons-material'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

export const ComplianceReports = () => {
  const { t } = useTranslation(['common', 'report'])
  const [alertMessage, setAlertMessage] = useState('')
  const [isButtonLoading, setIsButtonLoading] = useState(false)
  const [alertSeverity, setAlertSeverity] = useState('info')

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const gridRef = useRef()
  const alertRef = useRef()
  const navigate = useNavigate()
  const location = useLocation()
  const newButtonRef = useRef(null)
  const { hasRoles, data: currentUser } = useCurrentUser()

  const queryData = useGetComplianceReportList(paginationOptions, {
    cacheTime: 0,
    staleTime: 0
  })

  const handleRefresh = () => {
    queryData.refetch()
  }

  const getRowId = useCallback(
    (params) => params.data.complianceReportGroupUuid,
    []
  )

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const { mutate: createComplianceReport, isLoading: isCreating } =
    useCreateComplianceReport(currentUser?.organization?.organizationId, {
      onSuccess: (response, variables) => {
        setAlertMessage(
          t('report:actionMsgs.successText', {
            status: 'created'
          })
        )
        setIsButtonLoading(false)
        setAlertSeverity('success')
        navigate(
          buildPath(ROUTES.REPORTS.VIEW, {
            compliancePeriod: response.data.compliancePeriod.description,
            complianceReportId: response.data.complianceReportId
          }),
          { state: { data: response.data, newReport: true } }
        )
        alertRef.current.triggerAlert()
      },
      onError: (_error, _variables) => {
        setIsButtonLoading(false)
        const errorMsg = _error.response.data?.detail
        setAlertMessage(errorMsg)
        setAlertSeverity('error')
        alertRef.current.triggerAlert()
      }
    })

  useEffect(() => {
    if (isCreating) {
      setIsButtonLoading(true)
    }
  }, [isCreating])

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: (data) =>
          `${data.data.compliancePeriod}/${data.data.complianceReportId}`,
        state: (data) => ({ reportStatus: data?.reportStatus })
      }
    }),
    []
  )

  const handleClearFilters = () => {
    setPaginationOptions(initialPaginationOptions)
    sessionStorage.removeItem('compliance-reports-grid-filter')
    sessionStorage.removeItem('compliance-reports-grid-column')

    if (gridRef?.current) {
      gridRef.current.clearFilters?.()

      const defaultSortState =
        initialPaginationOptions.sortOrders?.map((order, index) => ({
          colId: order.field,
          sort: order.direction,
          sortIndex: index
        })) || []

      gridRef.current.api?.applyColumnState({
        state: defaultSortState,
        defaultState: { sort: null }
      })
    }
  }

  return (
    <>
      <div>
        {alertMessage && (
          <BCAlert
            ref={alertRef}
            data-test="alert-box"
            severity={alertSeverity}
            delay={6500}
          >
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCTypography variant="h5" color="primary">
        {t('report:title')}
      </BCTypography>
      <Stack
        direction={{ md: 'coloumn', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        my={{ xs: 1, sm: 1, md: 2 }}
        mx={0}
      >
        <Role roles={[roles.compliance_reporting]}>
          <NewComplianceReportButton
            ref={newButtonRef}
            handleNewReport={(option) => {
              createComplianceReport({
                compliancePeriod: option.description,
                organizationId: currentUser?.organization?.organizationId,
                status: COMPLIANCE_REPORT_STATUSES.DRAFT
              })
            }}
            isButtonLoading={isButtonLoading}
            setIsButtonLoading={setIsButtonLoading}
          />
        </Role>
        <ClearFiltersButton
          onClick={handleClearFilters}
          sx={{
            display: 'flex',
            alignItems: 'center'
          }}
        />
        <BCButton
          data-test="credit-calculator"
          sx={{ '& .MuiSvgIcon-root': { fontSize: '1.2rem !important' } }}
          variant="outlined"
          size="small"
          color="primary"
          onClick={() => navigate(ROUTES.CREDIT_CALCULATOR)}
          startIcon={<CalculateOutlined />}
        >
          {t('report:calcTitle')}
        </BCButton>
        <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
          <BCGridViewer
            gridRef={gridRef}
            gridKey="compliance-reports-grid"
            columnDefs={reportsColDefs(
              t,
              hasRoles(roles.supplier),
              handleRefresh
            )}
            queryData={queryData}
            dataKey="reports"
            getRowId={getRowId}
            overlayNoRowsTemplate={t('report:noReportsFound')}
            autoSizeStrategy={{
              type: 'fitGridWidth',
              defaultMinWidth: 50,
              defaultMaxWidth: 600
            }}
            defaultColDef={defaultColDef}
            paginationOptions={paginationOptions}
            onPaginationChange={(newPagination) => {
              setPaginationOptions(newPagination)
            }}
          />
        </BCBox>
      </Stack>
    </>
  )
}
