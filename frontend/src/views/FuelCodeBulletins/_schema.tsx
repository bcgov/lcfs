import { FuelCodeStatusBadge } from './components/FuelCodeStatusBadge'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { TFunction } from 'i18next'
import { Link } from 'react-router-dom'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components/Filters/BCDateFloatingFilter'
import { fuelCodeColDefs as idirFuelCodeColDefs } from '@/views/FuelCodes/_schema'
import { ROUTES, buildPath } from '@/routes/routes'

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
  value: number | string | null | undefined
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

export interface FuelCodeRow {
  id: string
  fuelCodeId?: number | string
  status?: string
  fuelCode: string
  fuel: string
  company: string
  carbonIntensity: number
  effectiveDate: string
  expiryDate: string
  [key: string]: unknown
}

type FuelCodeGridRow = FuelCodeRow & {
  fuelCodeId?: number | string
  status?: string
}

export type FuelCodeCellParams = ICellRendererParams<FuelCodeGridRow>
type FuelCodeValueParams = { value?: number | string | null }

const linkCellRenderer = (originalRenderer?: ColDef<FuelCodeGridRow>['cellRenderer']) => {
  return function FuelCodeLinkCellRenderer(params: FuelCodeCellParams) {
  const path = fuelCodeDetailPath(params.data?.fuelCodeId);
  const content = typeof originalRenderer === 'function' ? originalRenderer(params) : params.valueFormatted || params.value || '';
  if (!path) return content;
  return <Link to={path} style={{
    color: 'inherit',
    display: 'block',
    height: '100%',
    textDecoration: 'none',
    width: '100%'
  }}>
        {content}
      </Link>;
}
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
      valueFormatter: (params: FuelCodeValueParams) =>
        formatCarbonIntensity(params.value)
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
      valueFormatter: (params: FuelCodeValueParams) => formatDate(params.value)
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
      valueFormatter: (params: FuelCodeValueParams) => formatDate(params.value)
    }
  ]
}


export const normalizeRows = (rows: unknown[] = []): FuelCodeRow[] =>
  rows.map((value, index) => {
    const row = value as Record<string, unknown>
    return {
      ...row,
      id: `${row.fuelCode}-${row.effectiveDate || index}`,
      // Aliases so the canonical IDIR fuelCodeColDefs can render unchanged
      fuelType: row.fuel,
      expirationDate: row.expiryDate
    } as FuelCodeRow
  })
