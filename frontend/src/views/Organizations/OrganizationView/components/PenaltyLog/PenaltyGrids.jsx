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

const initialPaginationOptions = {
  ...defaultInitialPagination
}

const normalizeSortDirection = (sort) => sort.direction ?? sort.sort

const getFilterValue = (filter) => filter.filter ?? filter.value

const applyLocalFilters = (rows, filters = []) =>
  filters.reduce((filteredRows, filter) => {
    const field = filter.field ?? filter.colId
    const filterValue = getFilterValue(filter)

    if (!field || filterValue === undefined || filterValue === null) {
      return filteredRows
    }

    if (filter.filterType === 'set') {
      const values = filter.values ?? filterValue
      const acceptedValues = Array.isArray(values) ? values : [values]
      return filteredRows.filter((row) =>
        acceptedValues
          .map((value) => String(value).toLowerCase())
          .includes(String(row[field] ?? '').toLowerCase())
      )
    }

    if ((filter.type ?? 'contains') !== 'contains' || filterValue === '') {
      return filteredRows
    }

    return filteredRows.filter((row) =>
      String(row[field] ?? '')
        .toLowerCase()
        .includes(String(filterValue).toLowerCase())
    )
  }, rows)

const applyLocalSortOrders = (rows, sortOrders = []) =>
  [...rows].sort((a, b) => {
    for (const sort of sortOrders) {
      const field = sort.field ?? sort.colId
      const direction = normalizeSortDirection(sort)
      if (!field || !direction) continue

      const aValue = a[field]
      const bValue = b[field]
      let comparison = 0

      if (aValue === null || aValue === undefined) comparison = -1
      else if (bValue === null || bValue === undefined) comparison = 1
      else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      } else {
        comparison = String(aValue).localeCompare(String(bValue), undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      }

      if (comparison !== 0) {
        return direction === 'desc' ? -comparison : comparison
      }
    }

    return 0
  })

const buildLocalPenaltyQuery = (rows, paginationOptions) => {
  const page = paginationOptions.page || 1
  const size = paginationOptions.size || rows.length
  const filteredRows = applyLocalFilters(rows, paginationOptions.filters)
  const sortedRows = applyLocalSortOrders(
    filteredRows,
    paginationOptions.sortOrders
  )
  const total = sortedRows.length
  const startIndex = size ? (page - 1) * size : 0
  const endIndex = size ? startIndex + size : total

  return {
    data: {
      penaltyLogs: sortedRows.slice(startIndex, endIndex),
      pagination: {
        total,
        page,
        size,
        totalPages: size ? Math.max(1, Math.ceil(total / size)) : 1
      }
    },
    isLoading: false,
    isError: false
  }
}

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
                {t('org:penaltyLog.metrics.totalPenalties')}:{' '}
              </BCTypography>
              <BCTypography variant="h6" color="primary" component="span">
                {totals.totalPenalties}
              </BCTypography>
            </BCBox>
            <BCBox>
              <BCTypography variant="body2" color="text" component="span">
                {t('org:penaltyLog.columns.invoiced')}:{' '}
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
    initialPaginationOptions
  )

  const penaltyLogsQuery = useOrganizationPenaltyLogs(
    organizationId,
    { ...paginationOptions },
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

    return {
      ...penaltyLogsQuery,
      data: {
        ...(penaltyLogsQuery.data ?? {}),
        penaltyLogs: manualRows
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
    setPaginationOptions({ ...initialPaginationOptions })
  }, [])

  const handlePaginationChange = useCallback((newPagination) => {
    setPaginationOptions(newPagination)
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
