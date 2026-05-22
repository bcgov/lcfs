import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Stack } from '@mui/material'
import Grid2 from '@mui/material/Grid2'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons'

import BCAlert from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { Role } from '@/components/Role'
import { govRoles, roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import withRole from '@/utils/withRole'
import { LinkRenderer } from '@/utils/grid/cellRenderers.jsx'
import ROUTES from '@/routes/routes'

import { useGetCIApplications } from '@/hooks/useCIApplication'
import {
  ciApplicationsColDefs,
  defaultSortModel,
  getResumeStep
} from './_schema'
import { FuelCodesTabs } from './components/FuelCodesTabs'

const initialPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

const CIApplicationsBase = () => {
  const { t } = useTranslation(['common', 'carbonIntensity'])
  const navigate = useNavigate()
  const location = useLocation()
  const gridRef = useRef(null)
  const { hasAnyRole } = useCurrentUser()
  const isGovernment = hasAnyRole(...govRoles)

  const [paginationOptions, setPaginationOptions] = useState(
    initialPaginationOptions
  )
  const [alertMessage, setAlertMessage] = useState('')
  const [alertSeverity, setAlertSeverity] = useState('info')

  const queryData = useGetCIApplications(paginationOptions)

  const columnDefs = useMemo(
    () => ciApplicationsColDefs(t, { isGovernment }),
    [t, isGovernment]
  )

  useEffect(() => {
    if (location.state?.message) {
      setAlertMessage(location.state.message)
      setAlertSeverity(location.state.severity || 'info')
    }
  }, [location.state])

  useEffect(() => {
    if (queryData.isError && queryData.error) {
      setAlertMessage(
        queryData.error.message || 'Failed to load CI applications'
      )
      setAlertSeverity('error')
    }
  }, [queryData.isError, queryData.error])

  const getRowId = (params) => params.data.ciApplicationId.toString()

  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        url: (data) => {
          const row = data.data
          const step = getResumeStep(row)
          return `${row.ciApplicationId}?step=${step}`
        }
      }
    }),
    []
  )

  return (
    <Grid2 className="ci-applications-container" mx={-1}>
      <FuelCodesTabs />

      {alertMessage && (
        <BCAlert data-test="alert-box" severity={alertSeverity}>
          {alertMessage}
        </BCAlert>
      )}

      <BCTypography variant="h5" color="primary" data-test="title">
        {isGovernment
          ? t('carbonIntensity:ciApplications')
          : t('carbonIntensity:myOrgCIApplications')}
      </BCTypography>

      <Stack
        direction={{ md: 'column', lg: 'row' }}
        spacing={{ xs: 2, sm: 2, md: 3 }}
        useFlexGap
        flexWrap="wrap"
        mt={1}
        mb={2}
      >
        <Role roles={[roles.ci_applicant, roles.signing_authority]}>
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            startIcon={
              <FontAwesomeIcon icon={faCirclePlus} className="small-icon" />
            }
            data-test="new-ci-application-btn"
            onClick={() => navigate(ROUTES.CI_APPLICATIONS.ADD)}
          >
            <BCTypography variant="subtitle2">
              {t('carbonIntensity:newCIApplicationBtn')}
            </BCTypography>
          </BCButton>
        </Role>
      </Stack>

      <BCBox component="div" sx={{ height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey="ci-applications-grid"
          columnDefs={columnDefs}
          getRowId={getRowId}
          overlayNoRowsTemplate={t('carbonIntensity:noCIApplicationsFound')}
          defaultColDef={defaultColDef}
          queryData={queryData}
          dataKey="ciApplications"
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination) =>
            setPaginationOptions((prev) => ({
              ...prev,
              ...newPagination
            }))
          }
        />
      </BCBox>
    </Grid2>
  )
}

export const CIApplications = withRole(
  CIApplicationsBase,
  [roles.ci_applicant, roles.signing_authority, roles.government],
  ROUTES.DASHBOARD
)
CIApplications.displayName = 'CIApplications'
