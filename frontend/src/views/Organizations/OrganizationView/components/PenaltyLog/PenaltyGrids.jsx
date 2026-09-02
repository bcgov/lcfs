import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { BCGridViewer } from '@/components/BCDataGrid/BCGridViewer'
import { defaultInitialPagination } from '@/constants/schedules'

import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import BCButton from '@/components/BCButton'
import { useOrganizationPenaltyLogs } from '@/hooks/useOrganization'
import { ROUTES, buildPath } from '@/routes/routes'
import {
  discretionaryPenaltyLogColumnDefs,
  penaltyLogColumnDefs
} from './_schema'

const buildLocalPenaltyQuery = (rows, paginationOptions) => ({
  data: {
    penaltyLogs: rows,
    pagination: {
      total: rows.length,
      page: paginationOptions.page,
      size: paginationOptions.size,
      totalPages: paginationOptions.size
        ? Math.max(1, Math.ceil(rows.length / paginationOptions.size))
        : 1
    }
  },
  isLoading: false,
  isError: false
})

export const AutomaticPenaltyLogGrid = ({
  automaticPenaltyRows = [],
  loading = false
}) => {
  const { t } = useTranslation(['org'])
  const automaticPenaltyGridRef = useRef(null)
  const [paginationOptions, setPaginationOptions] = useState(
    defaultInitialPagination
  )

  const automaticPenaltyQuery = useMemo(
    () => ({
      ...buildLocalPenaltyQuery(automaticPenaltyRows, paginationOptions),
      isLoading: loading
    }),
    [automaticPenaltyRows, loading, paginationOptions]
  )

  const totals = useMemo(
    () =>
      automaticPenaltyRows.reduce(
        (accumulator, row) => {
          accumulator.totalPenalties += 1
          if (row.invoiceSent) {
            accumulator.invoiced += 1
          }
          return accumulator
        },
        { totalPenalties: 0, invoiced: 0 }
      ),
    [automaticPenaltyRows]
  )

  const getPenaltyRowId = useCallback((params) => {
    const identifier = params.data?.penaltyLogId ?? params.data?.id
    return identifier !== undefined && identifier !== null
      ? String(identifier)
      : ''
  }, [])

  const automaticPenaltyDefaultColDef = useMemo(
    () => ({
      minWidth: 180,
      suppressFloatingFilterButton: true
    }),
    []
  )
  const columnState = useMemo(() => [], [])

  const handlePaginationChange = useCallback((newPagination) => {
    setPaginationOptions((prev) => ({ ...prev, ...newPagination }))
  }, [])

  return (
    <BCWidgetCard
      title={t('org:penaltyLog.autoPenalties')}
      sx={{ width: '100%' }}
      content={
        <Stack spacing={2} sx={{ width: '100%' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            sx={{ width: '100%' }}
          >
            <BCBox>
              <BCTypography variant="body2" color="text" component="span">
                Total penalties:{' '}
              </BCTypography>
              <BCTypography variant="h6" color="primary" component="span">
                {totals.totalPenalties}
              </BCTypography>
            </BCBox>
            <BCBox>
              <BCTypography variant="body2" color="text" component="span">
                Invoiced:{' '}
              </BCTypography>
              <BCTypography variant="h6" color="primary" component="span">
                {totals.invoiced}
              </BCTypography>
            </BCBox>
          </Stack>
          <BCBox sx={{ width: '100%' }}>
            <BCGridViewer
              gridKey="automatic-penalty-log-history"
              gridRef={automaticPenaltyGridRef}
              columnDefs={penaltyLogColumnDefs}
              columnState={columnState}
              defaultColDef={automaticPenaltyDefaultColDef}
              queryData={automaticPenaltyQuery}
              dataKey="penaltyLogs"
              paginationOptions={paginationOptions}
              onPaginationChange={handlePaginationChange}
              getRowId={getPenaltyRowId}
              loading={loading}
              enablePageCaching={false}
            />
          </BCBox>
        </Stack>
      }
    />
  )
}

// Separate component for discretionary penalty grid
export const DiscretionaryPenaltyLogGrid = ({ organizationId }) => {
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

  const discretionaryPenaltyLogsQuery = useMemo(() => {
    const manualRows =
      penaltyLogsQuery.data?.penaltyLogs?.map((row) => ({
        ...row,
        id: row.penaltyLogId,
        description: row.description ?? row.contraventionType,
        dueDate: row.dueDate ?? '',
        invoiceSent: row.invoiceSent,
        paymentReceived: row.paymentReceived,
        source: row.source ?? 'manual'
      })) ?? []

    const penaltyLogs = manualRows.sort((a, b) => {
      const yearCompare = String(b.complianceYear ?? '').localeCompare(
        String(a.complianceYear ?? '')
      )
      if (yearCompare !== 0) return yearCompare
      return String(a.description ?? '').localeCompare(
        String(b.description ?? '')
      )
    })

    return {
      ...penaltyLogsQuery,
      data: {
        ...(penaltyLogsQuery.data ?? {}),
        penaltyLogs,
        pagination: {
          ...(penaltyLogsQuery.data?.pagination ?? {}),
          total: penaltyLogs.length
        }
      }
    }
  }, [penaltyLogsQuery])

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
      minWidth: 180,
      suppressFloatingFilterButton: true
    }),
    []
  )
  const columnState = useMemo(() => [], [])

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
        {t('org:penaltyLog.discretionaryPenalties')}
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
          columnDefs={discretionaryPenaltyLogColumnDefs}
          columnState={columnState}
          defaultColDef={penaltyLogDefaultColDef}
          queryData={discretionaryPenaltyLogsQuery}
          dataKey="penaltyLogs"
          paginationOptions={paginationOptions}
          onPaginationChange={handlePaginationChange}
          getRowId={getPenaltyRowId}
          loading={discretionaryPenaltyLogsQuery.isLoading}
          enablePageCaching={false}
        />
      </BCBox>
    </Stack>
  )
}

export const PenaltyHistoryGrid = DiscretionaryPenaltyLogGrid
