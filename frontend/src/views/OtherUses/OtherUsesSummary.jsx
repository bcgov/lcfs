import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import Grid2 from '@mui/material/Unstable_Grid2/Grid2'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCDataGridServer from '@/components/BCDataGrid/BCDataGridServer'
import { DownloadButton } from '@/components/DownloadButton'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { ROUTES, apiRoutes } from '@/constants/routes'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'
import { faCirclePlus, faEdit } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const OtherUsesSummary = ({ compliancePeriod }) => {
  const [isDownloadingOtherUses, setIsDownloadingOtherUses] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')
  const [gridKey, setGridKey] = useState(`other-uses-grid`)
  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('hid')
  const { complianceReportId } = useParams()

  const { data: currentUser } = useCurrentUser()
  const userRoles = currentUser?.roles?.map((role) => role.name) || []
  const isAuthorized = [
    roles.analyst,
    roles.compliance_manager,
    roles.director,
    roles.supplier
  ].some((role) => userRoles.includes(role))

  const gridRef = useRef()
  const apiService = useApiService()
  const { t } = useTranslation(['common', 'otherUses'])
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  const gridOptions = useMemo(() => ({
    overlayNoRowsTemplate: t('otherUses:noOtherUsesFound'),
    autoSizeStrategy: {
      type: 'fitCellContents',
      defaultMinWidth: 50,
      defaultMaxWidth: 600
    }
  }), [t])

  const columns = [
    { headerName: "Fuel Type", field: "fuelType", floatingFilter: false },
    { headerName: "Fuel Category", field: "fuelCategory", floatingFilter: false },
    { headerName: "Quantity Supplied", field: "quantitySupplied", floatingFilter: false },
    { headerName: "Units", field: "units", floatingFilter: false },
    { headerName: "Expected Use", field: "expectedUse", floatingFilter: false },
    { headerName: "Rationale", field: "rationale", floatingFilter: false },
  ];

  const getRowId = (params) => params.data.otherUsesId

  const handleGridKey = () => setGridKey(`other-uses-grid-${uuid()}`)

  const handleDownloadOtherUses = async () => {
    setIsDownloadingOtherUses(true)
    setAlertMessage('')
    try {
      await apiService.download(ROUTES.ADMIN_OTHER_USES + '/export')
      setIsDownloadingOtherUses(false)
    } catch (error) {
      console.error('Error downloading other uses information:', error)
      setIsDownloadingOtherUses(false)
      setAlertMessage(t('otherUses:otherUsesDownloadFailMsg'))
      setAlertSeverity('error')
    }
  }

  return (
    <Grid2 className="other-uses-container" mx={-1}>
      <div>
        {alertMessage && (
          <BCAlert data-test="alert-box" severity={alertSeverity}>
            {alertMessage}
          </BCAlert>
        )}
      </div>
      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCDataGridServer
          className={'ag-theme-material'}
          gridRef={gridRef}
          apiEndpoint={apiRoutes.getOtherUses}
          apiData={'otherUses'}
          apiParams={{complianceReportId}}
          columnDefs={columns}
          gridKey={gridKey}
          getRowId={getRowId}
          gridOptions={gridOptions}
          handleGridKey={handleGridKey}
          enableCopyButton={false}
          highlightedRowId={highlightedId}
        />
      </BCBox>
    </Grid2>
  )
}

OtherUsesSummary.displayName = 'OtherUsesSummary'
