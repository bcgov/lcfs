// mui components
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { Stack, Typography } from '@mui/material'
// react components
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
// Services
import { Role } from '@/components/Role'
// constants
import { roles } from '@/constants/roles'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
// hooks
import { useCreateComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
// internal components
import { defaultSortModel, reportsColDefs } from './components/_schema'
import { NewComplianceReportButton } from './components/NewComplianceReportButton'

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRowClicked = useCallback(
    ({ data }) => {
      navigate(
        ROUTES.REPORTS_VIEW.replace(
          ':compliancePeriod',
          data.compliancePeriod.description
        ).replace(':complianceReportId', data.complianceReportId)
      )
    },
    [navigate]
  )

  const handleGridKey = useCallback(() => {
    setGridKey(`reports-grid`)
  }, [])

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const { mutate: createComplianceReport, isPending: isCreating } =
    useCreateComplianceReport(currentUser?.organization?.organizationId)

  useEffect(() => {
    if (isCreating) {
      setIsButtonLoading(true)
    }
  }, [isCreating])
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
      <Typography variant="h5" color="primary">
        {t('report:title')}
      </Typography>
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
              createComplianceReport(
                {
                  compliancePeriod: option.description,
                  organizationId: currentUser?.organization?.organizationId,
                  status: COMPLIANCE_REPORT_STATUSES.DRAFT
                },
                {
                  onSuccess: (data) => {
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
                        data.data.compliancePeriod.description
                      ).replace(
                        ':complianceReportId',
                        data.data.complianceReportId
                      ),
                      { state: { data: data.data, newReport: true } }
                    )
                    alertRef.current.triggerAlert()
                  },
                  onError: (error) => {
                    setIsButtonLoading(false)
                    const errorMsg = error.response.data?.detail
                    setAlertMessage(errorMsg)
                    setAlertSeverity('error')
                    alertRef.current.triggerAlert()
                  }
                }
              )
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
            handleRowClicked={handleRowClicked}
            enableCopyButton={false}
          />
        </BCBox>
      </Stack>
    </>
  )
}
