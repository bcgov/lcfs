import i18n from '@/i18n'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components/Filters/BCDateFloatingFilter'
import { formatNumberWithCommas } from '@/utils/formatters'

const parseDateOnly = (value) => {
  if (!value) return null
  if (value instanceof Date) return value

  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDateOnly = (value) => {
  if (!value) return ''
  const dateOnly = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (dateOnly) return dateOnly[1]

  const date = parseDateOnly(value)
  return date ? date.toLocaleDateString('en-CA') : String(value)
}

const dateFilterComparator = (filterLocalDateAtMidnight, cellValue) => {
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

export const supplyHistoryColDefs = () => [
  {
    field: 'compliancePeriod',
    headerName: i18n.t('org:supplyHistory.columns.year'),
    minWidth: 130,
    maxWidth: 160,
    flex: 0.6,
    sortable: true
  },
  {
    field: 'reportSubmissionDate',
    headerName: i18n.t('org:supplyHistory.columns.submissionDate'),
    minWidth: 180,
    flex: 0.8,
    sortable: true,
    filter: 'agDateColumnFilter',
    filterParams: {
      filterOptions: ['equals', 'lessThan', 'greaterThan', 'inRange'],
      defaultOption: 'equals',
      suppressAndOrCondition: true,
      comparator: dateFilterComparator
    },
    floatingFilterComponent: BCDateFloatingFilter,
    floatingFilterComponentParams: {
      initialFilterType: 'equals',
      label: 'YYYY-MM-DD'
    },
    valueFormatter: (params) => formatDateOnly(params.value)
  },
  {
    field: 'fuelType',
    headerName: i18n.t('org:supplyHistory.columns.fuelType'),
    minWidth: 200,
    flex: 1.1,
    sortable: true
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t('org:supplyHistory.columns.fuelCategory'),
    minWidth: 180,
    flex: 1,
    sortable: true
  },
  {
    field: 'provisionOfTheAct',
    headerName: i18n.t('org:supplyHistory.columns.provision'),
    minWidth: 260,
    flex: 1.2,
    sortable: true
  },
  {
    field: 'fuelCode',
    headerName: i18n.t('org:supplyHistory.columns.fuelCode'),
    minWidth: 140,
    flex: 0.8,
    sortable: true,
    valueFormatter: (params) => params.value || '-'
  },
  {
    field: 'fuelQuantity',
    headerName: i18n.t('org:supplyHistory.columns.quantity'),
    minWidth: 150,
    flex: 0.9,
    sortable: true,
    filter: 'agNumberColumnFilter',
    valueFormatter: formatNumberWithCommas
  },
  {
    field: 'units',
    headerName: i18n.t('org:supplyHistory.columns.units'),
    minWidth: 100,
    maxWidth: 140,
    flex: 0.5,
    sortable: true
  }
]

export const defaultColDef = {
  editable: false,
  resizable: true,
  filter: true,
  floatingFilter: true,
  sortable: true,
  suppressFloatingFilterButton: true,
  flex: 1,
  minWidth: 150
}

export const gridOptions = {
  overlayNoRowsTemplate: i18n.t('org:supplyHistory.noDataFound'),
  autoSizeStrategy: {
    type: 'fitCellContents',
    defaultMinWidth: 50,
    defaultMaxWidth: 600
  },
  enableCellTextSelection: true,
  ensureDomOrder: true
}
