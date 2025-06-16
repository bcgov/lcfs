import {
  numberFormatter,
  currencyFormatter,
  dateFormatter,
  spacesFormatter
} from '@/utils/formatters'
import { TransactionStatusRenderer } from '@/utils/grid/cellRenderers'
import {
  BCSelectFloatingFilter,
  BCDateFloatingFilter
} from '@/components/BCDataGrid/components'
import { useTransactionStatuses } from '@/hooks/useTransactions'

const prefixMap = {
  Transfer: 'CT',
  AdminAdjustment: 'AA',
  InitiativeAgreement: 'IA',
  ComplianceReport: 'CR'
}

export const transactionsColDefs = (t) => [
  {
    colId: 'status',
    field: 'status',
    headerName: t('txn:txnColLabels.status'),
    cellRenderer: TransactionStatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'status',
      labelKey: 'status',
      optionsQuery: useTransactionStatuses
    },
    filterParams: {
      textFormatter: (value) => value.toLowerCase(),
      textCustomComparator: (filter, value, filterText) => {
        // Split the filter text by comma and trim each value
        const filterValues = filterText
          .split(',')
          .map((text) => text.trim().toLowerCase())

        const cleanValue = value.toLowerCase()

        // Return true if the value matches any of the filter values
        return filterValues.some((filterValue) =>
          cleanValue.includes(filterValue)
        )
      },
      buttons: ['clear']
    },
    suppressFloatingFilterButton: true,
    minWidth: 150
  },
  {
    colId: 'transactionId',
    field: 'transactionId',
    headerName: t('txn:txnColLabels.txnId'),
    width: 130,
    valueGetter: (params) => {
      const transactionType = params.data.transactionType
      const prefix = prefixMap[transactionType] || ''
      return `${prefix}${params.data.transactionId}`
    },
    filterParams: {
      buttons: ['clear']
    },
    comparator: (valueA, valueB) => {
      const numberA = parseInt(valueA.slice(1), 10)
      const numberB = parseInt(valueB.slice(1), 10)

      return numberB - numberA
    }
  },
  {
    colId: 'compliancePeriod',
    field: 'compliancePeriod',
    headerName: t('txn:txnColLabels.compliancePeriod'),
    width: 130,
    valueGetter: (params) => {
      return params.data?.compliancePeriod || 'N/A'
    },
    filter: true,
    filterParams: {
      filterOptions: ['startsWith'],
      buttons: ['clear']
    }
  },
  {
    colId: 'transactionType',
    field: 'transactionType',
    headerName: t('txn:txnColLabels.type'),
    valueGetter: (params) => {
      const value = spacesFormatter({ value: params.data.transactionType })
      const suffix = params.data.description

      if (suffix) {
        return `${value} - ${suffix}`
      }
      return value
    },
    filter: true, // Enable filtering
    filterParams: {
      textFormatter: (value) => value.replace(/\s+/g, '').toLowerCase(),
      textCustomComparator: (filter, value, filterText) => {
        // Remove spaces and convert both to lowercase for comparison
        const cleanFilterText = filterText.replace(/\s+/g, '').toLowerCase()
        const cleanValue = value.replace(/\s+/g, '').toLowerCase()
        return cleanValue.includes(cleanFilterText)
      },
      buttons: ['clear']
    },
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'transactionType',
      labelKey: 'transactionType',
      optionsQuery: () => ({
        data: [
          { transactionType: 'Compliance Report' },
          { transactionType: 'Admin Adjustment' },
          { transactionType: 'Transfer' },
          { transactionType: 'Initiative Agreement' }
        ],
        isLoading: false
      })
    },
    suppressFloatingFilterButton: true,
    width: 222
  },
  {
    colId: 'fromOrganization',
    field: 'fromOrganization',
    headerName: t('txn:txnColLabels.organizationFrom'),
    minWidth: 300,
    flex: 2,
    valueGetter: (params) => {
      return params.data.fromOrganization || 'N/A'
    },
    filterParams: {
      buttons: ['clear']
    }
  },
  {
    colId: 'toOrganization',
    field: 'toOrganization',
    headerName: t('txn:txnColLabels.organizationTo'),
    minWidth: 300,
    flex: 2,
    filterParams: {
      buttons: ['clear']
    }
  },
  {
    colId: 'quantity',
    field: 'quantity',
    headerName: t('txn:txnColLabels.quantity'),
    valueFormatter: numberFormatter,
    minWidth: 140,
    width: 140,
    filter: 'agNumberColumnFilter',
    filterParams: {
      filterOptions: ['startsWith'],
      buttons: ['clear']
    }
  },
  {
    colId: 'pricePerUnit',
    field: 'pricePerUnit',
    headerName: t('txn:txnColLabels.pricePerUnit'),
    valueFormatter: currencyFormatter,
    width: 190,
    valueGetter: (params) => {
      const value = params.data?.pricePerUnit
      return value !== null && value !== undefined ? value : 'N/A'
    },
    filter: 'agNumberColumnFilter',
    filterParams: {
      filterOptions: ['startsWith'],
      buttons: ['clear']
    }
  },
  {
    colId: 'updateDate',
    field: 'updateDate',
    headerName: t('txn:txnColLabels.updateDate'),
    valueFormatter: dateFormatter,
    minWidth: 250,
    filter: 'agDateColumnFilter',
    filterParams: {
      filterOptions: ['inRange', 'equals', 'lessThan', 'greaterThan'],
      defaultOption: 'inRange',
      comparator: (filterDate, cellValue) => {
        const cellDate = new Date(cellValue).setHours(0, 0, 0, 0)
        const filterDateOnly = new Date(filterDate).setHours(0, 0, 0, 0)

        if (cellDate < filterDateOnly) {
          return -1 // Cell date is before the filter date
        } else if (cellDate > filterDateOnly) {
          return 1 // Cell date is after the filter date
        } else {
          return 0 // Dates are the same (ignoring time)
        }
      },
      browserDatePicker: true, // Uses the browser's date picker if available
      buttons: ['clear']
    },
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  }
]

export const defaultSortModel = [{ field: 'updateDate', direction: 'desc' }]
