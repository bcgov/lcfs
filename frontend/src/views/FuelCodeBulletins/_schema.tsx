// @ts-nocheck
import { ColDef } from '@ag-grid-community/core'
import { TFunction } from 'i18next'
import { Link } from 'react-router-dom'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components'
import { fuelCodeColDefs as idirFuelCodeColDefs } from '@/views/FuelCodes/_schema'
import { ROUTES, buildPath } from '@/routes/routes'
import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'
import { getAllFuelCodeStatuses } from '@/constants/statuses'

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return dateFormatter.format(parsed)
}

export const formatCarbonIntensity = (
  value: number | null | undefined
): string => {
  if (value === null || value === undefined || value === '') return ''
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return Number.isInteger(num)
    ? String(num)
    : num.toFixed(2).replace(/\.00$/, '')
}

export const dateSortComparator = (a: string, b: string): number => {
  const left = a ? new Date(a).getTime() : -Infinity
  const right = b ? new Date(b).getTime() : -Infinity
  return left - right
}

const parseDateOnly = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const dateFilterComparator = (
  filterLocalDateAtMidnight: Date,
  cellValue: string | null | undefined
): number => {
  const cellDate = parseDateOnly(cellValue)
  if (!cellDate) return -1
  const normalizedCellDate = new Date(
    cellDate.getFullYear(),
    cellDate.getMonth(),
    cellDate.getDate()
  )
  if (normalizedCellDate < filterLocalDateAtMidnight) return -1
  if (normalizedCellDate > filterLocalDateAtMidnight) return 1
  return 0
}

const dateFilterParams = {
  filterOptions: ['equals', 'lessThan', 'greaterThan', 'inRange'],
  defaultOption: 'equals',
  suppressAndOrCondition: true,
  comparator: dateFilterComparator
}

const dateFloatingFilterParams = {
  initialFilterType: 'equals',
  label: 'YYYY-MM-DD'
}

const idirDateFields = new Set([
  'applicationDate',
  'approvalDate',
  'effectiveDate',
  'expirationDate'
])

const fuelCodeDetailPath = (fuelCodeId: unknown): string | null => {
  const id = Number(fuelCodeId)
  if (!Number.isInteger(id) || id <= 0) return null
  return buildPath(ROUTES.FUEL_CODES.VIEW, { fuelCodeID: id })
}

const linkCellRenderer = (originalRenderer?: ColDef['cellRenderer']) => {
  return (params: any) => {
    const path = fuelCodeDetailPath(params.data?.fuelCodeId)
    const content =
      typeof originalRenderer === 'function'
        ? originalRenderer(params)
        : params.valueFormatted || params.value || ''

    if (!path) return content

    return (
      <Link
        to={path}
        style={{
          color: 'inherit',
          display: 'block',
          height: '100%',
          textDecoration: 'none',
          width: '100%'
        }}
      >
        {content}
      </Link>
    )
  }
}

const FuelCodeStatusBadge = (params: any) => {
  const statusArr = getAllFuelCodeStatuses()
  const statusIndex = statusArr.indexOf(params.data?.status)
  const statusColors = ['info', 'info', 'success', 'error']

  return (
    <BCBox sx={{ width: '100%', height: '100%' }}>
      <BCBox mt={1} sx={{ display: 'flex', justifyContent: 'center' }}>
        <BCBadge
          badgeContent={statusArr[statusIndex] ?? params.data?.status}
          color={statusColors[statusIndex] ?? 'info'}
          variant="contained"
          size="lg"
          sx={{
            '& .MuiBadge-badge': {
              minWidth: '120px',
              fontWeight: 'regular',
              textTransform: 'capitalize',
              fontSize: '0.875rem',
              padding: '0.4em 0.6em'
            }
          }}
        />
      </BCBox>
    </BCBox>
  )
}

const clickableFuelCodeColDefs = (colDefs: ColDef[]): ColDef[] =>
  colDefs.map((colDef) => ({
    ...colDef,
    ...(idirDateFields.has(String(colDef.field))
      ? {
          filter: 'agDateColumnFilter',
          floatingFilterComponent: BCDateFloatingFilter,
          floatingFilterComponentParams: dateFloatingFilterParams,
          filterParams: dateFilterParams,
          suppressFloatingFilterButton: true
        }
      : {}),
    cellRenderer: linkCellRenderer(
      colDef.field === 'status' ? FuelCodeStatusBadge : colDef.cellRenderer
    ),
    cellStyle: {
      ...(typeof colDef.cellStyle === 'object' ? colDef.cellStyle : {}),
      cursor: 'pointer'
    }
  }))

export const buildColumnDefs = (t: TFunction, isIdir = false): ColDef[] => {
  if (isIdir) {
    return clickableFuelCodeColDefs(idirFuelCodeColDefs(t))
  }
  return [
    {
      headerName: t('columns.fuelCode'),
      field: 'fuelCode',
      filter: 'agTextColumnFilter',
      sortable: true,
      minWidth: 80
    },
    {
      headerName: t('columns.fuel'),
      field: 'fuel',
      filter: 'agTextColumnFilter',
      sortable: true,
      minWidth: 80
    },
    {
      headerName: t('columns.company'),
      field: 'company',
      filter: 'agTextColumnFilter',
      sortable: true,
      minWidth: 300
    },
    {
      headerName: t('columns.carbonIntensity'),
      field: 'carbonIntensity',
      filter: false,
      sortable: true,
      minWidth: 210,
      valueFormatter: (params: any) => formatCarbonIntensity(params.value)
    },
    {
      headerName: t('columns.effectiveDate'),
      field: 'effectiveDate',
      filter: 'agDateColumnFilter',
      floatingFilterComponent: BCDateFloatingFilter,
      floatingFilterComponentParams: dateFloatingFilterParams,
      filterParams: dateFilterParams,
      suppressFloatingFilterButton: true,
      sortable: true,
      minWidth: 180,
      comparator: dateSortComparator,
      valueFormatter: (params: any) => formatDate(params.value)
    },
    {
      headerName: t('columns.expiryDate'),
      field: 'expiryDate',
      filter: 'agDateColumnFilter',
      floatingFilterComponent: BCDateFloatingFilter,
      floatingFilterComponentParams: dateFloatingFilterParams,
      filterParams: dateFilterParams,
      suppressFloatingFilterButton: true,
      sortable: true,
      minWidth: 180,
      comparator: dateSortComparator,
      valueFormatter: (params: any) => formatDate(params.value)
    }
  ]
}

export interface FuelCodeRow {
  id: string
  fuelCode: string
  fuel: string
  company: string
  carbonIntensity: number
  effectiveDate: string
  expiryDate: string
  [key: string]: any
}

export const normalizeRows = (rows: any[] = []): FuelCodeRow[] =>
  rows.map((row, index) => ({
    ...row,
    id: `${row.fuelCode}-${row.effectiveDate || index}`,
    // Aliases so the canonical IDIR fuelCodeColDefs can render unchanged
    fuelType: row.fuel,
    expirationDate: row.expiryDate
  }))
