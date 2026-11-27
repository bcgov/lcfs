import Stack from '@mui/material/Stack'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import type { AlertSeverity } from '@/components/BCAlert/BCAlertRoot'
import type { BCAlertHandle } from '@/components/BCAlert/BCAlert'
import type { GetRowIdParams } from 'ag-grid-community'
import type {
  BCGridRef,
  BCGridQueryData,
  BCGridRow,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES, buildPath } from '@/routes/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useCreateComplianceReport,
  useGetComplianceReportList
} from '@/hooks/useComplianceReports'
import { reportsColDefs, defaultSortModel } from './components/_schema'
import { NewComplianceReportButton } from './components/NewComplianceReportButton'
import BCTypography from '@/components/BCTypography'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import '@/constants/schedules'
import BCButton from '@/components/BCButton'
import CalculateOutlined from '@mui/icons-material/CalculateOutlined'

const initialPaginationOptions: BCPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

interface ComplianceReportGridRow extends BCGridRow {
  complianceReportGroupUuid: string
  compliancePeriod: string
  complianceReportId: string | number
  reportStatus?: string
}

const isComplianceReportGridRow = (
  value: unknown
): value is ComplianceReportGridRow =>
  typeof value === 'object' &&
  value !== null &&
  'complianceReportGroupUuid' in value &&
  typeof value.complianceReportGroupUuid === 'string' &&
  'compliancePeriod' in value &&
  typeof value.compliancePeriod === 'string' &&
  'complianceReportId' in value &&
  (typeof value.complianceReportId === 'string' ||
    typeof value.complianceReportId === 'number')

const getErrorMessage = (error: unknown): string => {
  if (isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
  }
  return error instanceof Error ? error.message : ''
}

export const ComplianceReports = () => {
  const { t } = useTranslation(['common', 'report'])
  const [alertMessage, setAlertMessage] = useState('')
  const [isButtonLoading, setIsButtonLoading] = useState(false)
  const [alertSeverity, setAlertSeverity] = useState<AlertSeverity>('info')

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )

  const gridRef = useRef<BCGridRef['current']>(null)
  const alertRef = useRef<BCAlertHandle | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const newButtonRef = useRef(null)
  const { hasRoles, data: currentUser } = useCurrentUser()

  const queryData = useGetComplianceReportList(paginationOptions, {
    gcTime: 0,
    staleTime: 0
  })
  const gridQueryData: BCGridQueryData<BCGridRow> = {
    data: queryData.data,
    error: queryData.error,
    isError: queryData.isError,
    isLoading: queryData.isLoading
  }

  const handleRefresh = () => {
    queryData.refetch()
  }

  const getRowId = useCallback(
    (params: GetRowIdParams<BCGridRow>) =>
      params.data!.complianceReportGroupUuid as string,
    []
  )

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const { mutate: createComplianceReport, isPending: isCreating } =
    useCreateComplianceReport(currentUser?.organization?.organizationId, {
      onSuccess: (response) => {
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
        alertRef.current?.triggerAlert()
      },
      onError: (error) => {
        setIsButtonLoading(false)
        setAlertMessage(getErrorMessage(error))
        setAlertSeverity('error')
        alertRef.current?.triggerAlert()
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
        url: ({ data }: { data: unknown }) =>
          isComplianceReportGridRow(data)
            ? `${data.compliancePeriod}/${data.complianceReportId}`
            : '',
        state: (data: unknown) => ({
          reportStatus: isComplianceReportGridRow(data)
            ? data.reportStatus
            : undefined
        })
      }
    }),
    []
  )

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
        direction={{ md: 'column', lg: 'row' }}
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
                organizationId: currentUser?.organization?.organizationId
              })
            }}
            isButtonLoading={isButtonLoading}
            setIsButtonLoading={setIsButtonLoading}
          />
        </Role>
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
            queryData={gridQueryData}
            dataKey="reports"
            getRowId={getRowId}
            overlayNoRowsTemplate={t('report:noReportsFound')}
            autoSizeStrategy={{
              type: 'fitGridWidth',
              defaultMinWidth: 50
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
