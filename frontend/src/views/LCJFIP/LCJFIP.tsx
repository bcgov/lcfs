import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import { FloatingAlert } from '@/components/BCAlert'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { lcjfipBceidRoles, lcjfipIdirRoles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type {
  BCGridQueryData,
  BCPaginationOptions
} from '@/components/BCDataGrid/types'
import type { PaginationParams } from '@/hooks/types'
import {
  useLCJFIPApplications,
  type LCJFIPApplicationListItem
} from '@/hooks/useLCJFIP'
import ROUTES from '@/routes/routes'
import { LinkRenderer } from '@/utils/grid/cellRenderers'
import {
  getSessionPagination,
  gridCacheKey,
  removeGridCache
} from '@/utils/grid/sessionGridCache'
import withRole from '@/utils/withRole'
import { defaultSortModel, lcjfipApplicationColDefs } from './_schema'

export const LCJFIP_APPLICATIONS_GRID_KEY = 'lcjfip-applications-grid'

const initialPaginationOptions: BCPaginationOptions = {
  page: 1,
  size: 10,
  sortOrders: defaultSortModel,
  filters: []
}

const applicationUrl = (data: LCJFIPApplicationListItem) =>
  ROUTES.LCJFIP.APPLICATION.replace(
    ':applicationId',
    String(data.lcjfipApplicationId)
  )

// The Low carbon jet fuel incentive program's applications index (#5541).
// BCeID applicants see their organization's applications, Drafts included,
// and start new ones; government users see every organization's submitted
// applications.
export const LCJFIPBase = () => {
  const { t } = useTranslation(['lcjfip', 'common'])
  const location = useLocation()
  const navigate = useNavigate()
  const alertRef = useRef<{
    triggerAlert: (payload: {
      severity: 'success' | 'error'
      message: string
    }) => void
  } | null>(null)
  const gridRef = useRef(null)
  const { data: currentUser } = useCurrentUser()
  const isGovernment = !!currentUser?.isGovernmentUser

  const [paginationOptions, setPaginationOptions] = useState(() =>
    getSessionPagination(LCJFIP_APPLICATIONS_GRID_KEY, initialPaginationOptions)
  )
  const applicationsQuery = useLCJFIPApplications(
    paginationOptions as PaginationParams
  )
  const queryData: BCGridQueryData = useMemo(
    () => ({
      data: applicationsQuery.data,
      isLoading: applicationsQuery.isLoading,
      isError: applicationsQuery.isError,
      error: applicationsQuery.error
    }),
    [
      applicationsQuery.data,
      applicationsQuery.isLoading,
      applicationsQuery.isError,
      applicationsQuery.error
    ]
  )

  useEffect(() => {
    const state = location.state as { message?: string } | null
    if (state?.message) {
      alertRef.current?.triggerAlert({
        severity: 'success',
        message: state.message
      })
    }
  }, [location.state])

  useEffect(() => {
    if (applicationsQuery.isError) {
      alertRef.current?.triggerAlert({
        severity: 'error',
        message: t('lcjfip:index.loadError')
      })
    }
  }, [applicationsQuery.isError, t])

  const columnDefs = useMemo(
    () => lcjfipApplicationColDefs(t, { isGovernment }),
    [t, isGovernment]
  )
  const defaultColDef = useMemo(
    () => ({
      cellRenderer: LinkRenderer,
      cellRendererParams: {
        isAbsolute: true,
        url: ({ data }: { data: LCJFIPApplicationListItem }) =>
          applicationUrl(data)
      }
    }),
    []
  )
  const handleClearFilters = useCallback(() => {
    setPaginationOptions(initialPaginationOptions)
    removeGridCache(gridCacheKey(LCJFIP_APPLICATIONS_GRID_KEY, 'filter'))
    removeGridCache(gridCacheKey(LCJFIP_APPLICATIONS_GRID_KEY, 'pagination'))
  }, [])

  return (
    <BCBox>
      <FloatingAlert ref={alertRef as never} />
      {/* The layout's visually hidden h1 carries the route title, so the
          visible page title is the next heading level down. */}
      <BCTypography
        variant="h5"
        component="h2"
        color="primary"
        data-test="lcjfip-title"
      >
        {t('lcjfip:index.title')}
      </BCTypography>

      {!isGovernment && (
        <BCButton
          variant="contained"
          color="primary"
          startIcon={<AddCircleIcon />}
          onClick={() => navigate(ROUTES.LCJFIP.NEW_APPLICATION)}
          sx={{ mt: 3 }}
          data-test="lcjfip-new-application"
        >
          {t('lcjfip:index.newApplication')}
        </BCButton>
      )}

      <BCBox component="div" sx={{ mt: 3, height: '100%', width: '100%' }}>
        <BCGridViewer
          gridRef={gridRef}
          gridKey={LCJFIP_APPLICATIONS_GRID_KEY}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.lcjfipApplicationId)}
          overlayNoRowsTemplate={
            isGovernment
              ? t('lcjfip:index.noSubmittedApplications')
              : t('lcjfip:index.noApplications')
          }
          queryData={queryData}
          dataKey="applications"
          paginationOptions={paginationOptions}
          onPaginationChange={(newPagination: BCPaginationOptions) =>
            setPaginationOptions((previous) => ({
              ...previous,
              ...newPagination
            }))
          }
          persistForLoginSession
          onClearFilters={handleClearFilters}
        />
      </BCBox>
    </BCBox>
  )
}

// Users without a permitted role who open the URL directly are sent to the
// dashboard, the same access-denied behaviour as the other role-gated pages.
export const LCJFIP = withRole(
  LCJFIPBase,
  [...lcjfipBceidRoles, ...lcjfipIdirRoles],
  ROUTES.DASHBOARD
)
LCJFIP.displayName = 'LCJFIP'

export default LCJFIP
