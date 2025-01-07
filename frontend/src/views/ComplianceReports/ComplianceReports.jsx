import { Stack } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { apiRoutes, ROUTES } from '@/constants/routes'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useCreateComplianceReport } from '@/hooks/useComplianceReports'
import { defaultSortModel, reportsColDefs } from './components/_schema'
import { NewComplianceReportButton } from './components/NewComplianceReportButton'
import BCTypography from '@/components/BCTypography'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'

export const ComplianceReports = () => {
  const { t } = useTranslation(['common', 'report'])
  const [alertMessage, setAlertMessage] = useState('')
  const [isButtonLoading, setIsButtonLoading] = useState(false)
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`compliance-reports-grid`)

  const gridRef = useRef()
  const alertRef = useRef()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasRoles, data: currentUser } = useCurrentUser()

  const gridOptions = useMemo(
    () => ({
      overlayNoRowsTemplate: t('report:noReportsFound')
    }),
    [t]
  )
  const getRowId = useCallback(
    (params) => params.data.complianceReportId.toString(),
    []
  )

  const handleGridKey = useCallback(() => {
    setGridKey('reports-grid')
  }, [])

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
          ROUTES.REPORTS_VIEW.replace(
            ':compliancePeriod',
            response.data.compliancePeriod.description
          ).replace(':complianceReportId', response.data.complianceReportId),
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
          `${data.data.compliancePeriod.description}/${data.data.complianceReportId}`
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
        direction={{ md: 'coloumn', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        my={{ xs: 1, sm: 1, md: 2 }}
        mx={0}
      >
        <Role roles={[roles.supplier]}>
          <NewComplianceReportButton
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
        <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
          <BCDataGridServer
            gridRef={gridRef}
            apiEndpoint={
              hasRoles(roles.supplier)
                ? apiRoutes.getOrgComplianceReports.replace(
                    ':orgID',
                    currentUser?.organization?.organizationId
                  )
                : apiRoutes.getComplianceReports
            }
            apiData={'reports'}
            columnDefs={reportsColDefs(t, hasRoles(roles.supplier))}
            gridKey={gridKey}
            getRowId={getRowId}
            defaultSortModel={defaultSortModel}
            defaultFilterModel={location.state?.filters}
            gridOptions={gridOptions}
            handleGridKey={handleGridKey}
            enableCopyButton={false}
            defaultColDef={defaultColDef}
          />
        </BCBox>
      </Stack>
    </>
  )
}
