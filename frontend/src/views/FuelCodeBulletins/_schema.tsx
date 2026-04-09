import { ColDef } from '@ag-grid-community/core'
import { TFunction } from 'i18next'

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

export const buildColumnDefs = (t: TFunction): ColDef[] => [
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
    filter: false,
    sortable: true,
    minWidth: 180,
    comparator: dateSortComparator,
    valueFormatter: (params: any) => formatDate(params.value)
  },
  {
    headerName: t('columns.expiryDate'),
    field: 'expiryDate',
    filter: false,
    sortable: true,
    minWidth: 180,
    comparator: dateSortComparator,
    valueFormatter: (params: any) => formatDate(params.value)
  }
]

export interface FuelCodeRow {
  id: string
  fuelCode: string
  fuel: string
  company: string
  carbonIntensity: number
  effectiveDate: string
  expiryDate: string
}

export const normalizeRows = (rows: any[] = []): FuelCodeRow[] =>
  rows.map((row, index) => ({
    id: `${row.fuelCode}-${row.effectiveDate || index}`,
    fuelCode: row.fuelCode,
    fuel: row.fuel,
    company: row.company,
    carbonIntensity: row.carbonIntensity,
    effectiveDate: row.effectiveDate,
    expiryDate: row.expiryDate
  }))
