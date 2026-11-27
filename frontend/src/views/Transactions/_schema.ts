import type { ColDef } from 'ag-grid-community'
import {
  numberFormatter,
  currencyFormatter,
  dateFormatter,
  spacesFormatter,
  formatTransactionId,
  parseTransactionIdNumber
} from '@/utils/formatters'
import { TransactionStatusRenderer } from '@/utils/grid/cellRenderers'
import { BCSelectFloatingFilter } from '@/components/BCDataGrid/components/Filters/BCSelectFloatingFilter'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components/Filters/BCDateFloatingFilter'
import { useTransactionStatuses } from '@/hooks/useTransactions'

export const transactionsColDefs = (t: (key: string) => string): ColDef[] => [
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
      textFormatter: (value: string) => value.toLowerCase(),
      textCustomComparator: (
        _filter: string,
        value: string,
        filterText: string
      ) => {
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
    minWidth: 130,
    valueGetter: (params) =>
      formatTransactionId(
        params.data.transactionType,
        params.data.transactionId
      ),
    filterParams: {
      buttons: ['clear']
    },
    comparator: (valueA, valueB) =>
      parseTransactionIdNumber(valueB) - parseTransactionIdNumber(valueA)
  },
  {
    colId: 'compliancePeriod',
    field: 'compliancePeriod',
    headerName: t('txn:txnColLabels.compliancePeriod'),
    minWidth: 150,
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
    valueFormatter: (params) => {
      const transactionType = params.data.transactionType
      // Map StandaloneTransaction to Legacy Transaction for display
      const displayType =
        transactionType === 'StandaloneTransaction'
          ? 'Legacy Transaction'
          : spacesFormatter({ value: transactionType })
      const suffix = params.data.description

      if (suffix) {
        return `${displayType} - ${suffix}`
      }
      // spacesFormatter passes through nonstring inputs unchanged; AG Grid
      // models valueFormatter as returning a string, while this grid expects
      // the helper's existing pass-through behavior.
      return displayType as string
    },
    filter: true, // Enable filtering
    filterParams: {
      textFormatter: (value: string) => value.replace(/\s+/g, '').toLowerCase(),
      textCustomComparator: (
        _filter: string,
        value: string,
        filterText: string
      ) => {
        // Remove spaces and convert both to lowercase for comparison
        const cleanFilterText = filterText.replace(/\s+/g, '').toLowerCase()
        const cleanValue = value.replace(/\s+/g, '').toLowerCase()
        return cleanValue.includes(cleanFilterText)
      },
      buttons: ['clear']
    },
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'type',
      labelKey: 'transactionType',
      optionsQuery: () => ({
        data: [
          { transactionType: 'Compliance Report', type: 'ComplianceReport' },
          { transactionType: 'Admin Adjustment', type: 'AdminAdjustment' },
          { transactionType: 'Transfer', type: 'Transfer' },
          {
            transactionType: 'Initiative Agreement',
            type: 'InitiativeAgreement'
          },
          {
            transactionType: 'Legacy Transaction',
            type: 'StandaloneTransaction'
          },
          { transactionType: 'Aggregator Issuance', type: 'AggregatorIssuance' }
        ],
        isLoading: false
      })
    },
    suppressFloatingFilterButton: true,
    minWidth: 470,
    flex: 2
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
    // The formatter returns raw nonnumeric values unchanged; AG Grid's type
    // models this callback as string even though the runtime supports pass-through values.
    valueFormatter: (params) => currencyFormatter(params) as string,
    minWidth: 190,
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
      comparator: (filterDate: Date, cellValue: string) => {
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
