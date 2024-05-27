// mui components
import { Typography, Stack } from '@mui/material'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
// Icons
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// react components
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
// internal components
// Services
import { Role } from '@/components/Role'
// constants
import { roles } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { reportsColDefs } from './_schema'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const ComplianceReports = () => {
  const { t } = useTranslation(['common', 'report'])
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`compliance-reports-grid`)

  const gridRef = useRef()
  const { orgID } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { hasRoles, data: currentUser } = useCurrentUser()

  const gridOptions = useMemo(() => ({
    overlayNoRowsTemplate: t('report:noReportsFound')
  }))
  const getRowId = useCallback((params) => params.data.reportId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleRowClicked = useCallback((params) => {
    navigate(ROUTES.REPORTS_VIEW.replace(':reportID', params.data.reportId))
  })
  const handleGridKey = useCallback(() => {
    setGridKey(`reports-grid`)
  }, [])

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  return (
    <>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
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
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
            }
            onClick={() => navigate(ROUTES.REPORTS_ADD)}
          >
            <Typography variant="subtitle2">
              {t('report:newReportBtn')}
            </Typography>
          </BCButton>
        </Role>
        <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
          <BCDataGridServer
            gridRef={gridRef}
            apiEndpoint={
              hasRoles(roles.supplier)
                ? `organization/${currentUser.organization?.organizationId}/reports/list`
                : 'reports/'
            }
            apiData={'reports'}
            columnDefs={reportsColDefs(t, hasRoles(roles.supplier))}
            gridKey={gridKey}
            getRowId={getRowId}
            // defaultSortModel={defaultSortModel}
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
