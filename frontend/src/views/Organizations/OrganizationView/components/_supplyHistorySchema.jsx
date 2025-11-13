import i18n from '@/i18n'
import { formatNumberWithCommas } from '@/utils/formatters'

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
    valueFormatter: (params) => {
      if (!params.value) return ''
      const date = new Date(params.value)
      return date.toLocaleDateString('en-CA') // YYYY-MM-DD format
    }
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
    valueFormatter: formatNumberWithCommas,
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
