import i18n from '@/i18n'
import { formatNumberWithCommas } from '@/utils/formatters'

export const supplyHistoryColDefs = () => [
  {
    field: 'compliancePeriod',
    headerName: i18n.t('org:supplyHistory.columns.year'),
    minWidth: 100,
    sortable: true
  },
  {
    field: 'reportSubmissionDate',
    headerName: i18n.t('org:supplyHistory.columns.submissionDate'),
    minWidth: 150,
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
    sortable: true
  },
  {
    field: 'fuelCategory',
    headerName: i18n.t('org:supplyHistory.columns.fuelCategory'),
    minWidth: 150,
    sortable: true
  },
  {
    field: 'provisionOfTheAct',
    headerName: i18n.t('org:supplyHistory.columns.provision'),
    minWidth: 350,
    sortable: true
  },
  {
    field: 'fuelCode',
    headerName: i18n.t('org:supplyHistory.columns.fuelCode'),
    minWidth: 150,
    sortable: true,
    valueFormatter: (params) => params.value || '-'
  },
  {
    field: 'fuelQuantity',
    headerName: i18n.t('org:supplyHistory.columns.quantity'),
    minWidth: 120,
    sortable: true,
    valueFormatter: formatNumberWithCommas,
    type: 'numericColumn'
  },
  {
    field: 'units',
    headerName: i18n.t('org:supplyHistory.columns.units'),
    minWidth: 80,
    sortable: true
  }
]

export const defaultColDef = {
  editable: false,
  resizable: true,
  filter: false,
  floatingFilter: false,
  sortable: true
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
