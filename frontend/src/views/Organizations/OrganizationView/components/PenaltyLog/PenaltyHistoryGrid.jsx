import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer.jsx'
import { defaultInitialPagination } from '@/constants/schedules'

import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import BCButton from '@/components/BCButton'
import { useOrganizationPenaltyLogs } from '@/hooks/useOrganization'
import { ROUTES, buildPath } from '@/routes/routes'
import { penaltyLogColumnDefs } from './_schema'

// Separate component for penalty history grid
export const PenaltyHistoryGrid = ({ organizationId }) => {
  const { t } = useTranslation(['org'])
  const navigate = useNavigate()
  const penaltyLogGridRef = useRef(null)
  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const penaltyLogsQuery = useOrganizationPenaltyLogs(
    organizationId,
    paginationOptions,
    {
      enabled: !!organizationId
    }
  )

  const getPenaltyRowId = useCallback((params) => {
    const identifier =
      params.data?.penaltyLogId ??
      params.data?.penalty_log_id ??
      params.data?.id
    return identifier !== undefined && identifier !== null
      ? String(identifier)
      : ''
  }, [])

  const penaltyLogDefaultColDef = useMemo(
    () => ({
      flex: 1,
      minWidth: 180,
      suppressFloatingFilterButton: true
    }),
    []
  )

  const handleClearFilters = useCallback(() => {
    try {
      penaltyLogGridRef.current?.clearFilters?.()
    } catch (e) {
      // no-op
    }
    setPaginationOptions({ ...defaultInitialPagination })
  }, [])

  const handlePaginationChange = useCallback((newPagination) => {
    setPaginationOptions((prev) => ({ ...prev, ...newPagination }))
  }, [])

  return (
    <Stack spacing={2} mt={4} sx={{ width: '100%' }}>
      <BCTypography variant="h5" color="primary" fontWeight="medium">
        {t('org:penaltyLog.history')}
      </BCTypography>
      <Stack
        spacing={2}
        direction={{ md: 'row', xs: 'column' }}
        sx={{ width: '100%' }}
      >
        <Role roles={[roles.government]}>
          <BCButton
            variant="contained"
            size="small"
            color="primary"
            onClick={() => {
              if (!organizationId) return
              navigate(
                buildPath(ROUTES.ORGANIZATIONS.PENALTY_LOG_MANAGE, {
                  orgID: organizationId
                })
              )
            }}
          >
            <BCTypography variant="subtitle2">
              {t('org:penaltyLog.addPenaltyBtn')}
            </BCTypography>
          </BCButton>
        </Role>
        <ClearFiltersButton
          onClick={handleClearFilters}
          sx={{
            minWidth: 'fit-content',
            whiteSpace: 'nowrap'
          }}
        />
      </Stack>
      <BCBox component="div" sx={{ width: '100%' }}>
        <BCGridViewer
          gridKey="penalty-log-history"
          gridRef={penaltyLogGridRef}
          columnDefs={penaltyLogColumnDefs}
          defaultColDef={penaltyLogDefaultColDef}
          queryData={penaltyLogsQuery}
          dataKey="penaltyLogs"
          paginationOptions={paginationOptions}
          onPaginationChange={handlePaginationChange}
          getRowId={getPenaltyRowId}
          loading={penaltyLogsQuery.isLoading}
          enablePageCaching={false}
          autoSizeStrategy={{
            type: 'fitCellContents',
            defaultMinWidth: 120,
            defaultMaxWidth: 600
          }}
        />
      </BCBox>
    </Stack>
  )
}
