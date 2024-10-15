import {
  numberFormatter,
  currencyFormatter,
  dateFormatter,
  spacesFormatter,
} from '@/utils/formatters'
import { TransactionStatusRenderer } from '@/utils/grid/cellRenderers'
import { BCColumnSetFilter } from '@/components/BCDataGrid/components'
import { useTransactionStatuses } from '@/hooks/useTransactions'

const prefixMap = {
  Transfer: 'CT',
  AdminAdjustment: 'AA',
  InitiativeAgreement: 'IA'
}

export const transactionsColDefs = (t) => [
  {
    colId: 'transactionId',
    field: 'transactionId',
    headerName: t('txn:txnColLabels.txnId'),
    width: 175,
    valueGetter: (params) => {
      const transactionType = params.data.transactionType
      const prefix = prefixMap[transactionType] || ''
      return `${prefix}${params.data.transactionId}`
    },
    filterParams: {
      buttons:["clear"],
    }
  },
  {
    colId: 'transactionType',
    field: 'transactionType',
    headerName: t('txn:txnColLabels.type'),
    valueFormatter: spacesFormatter,
    filter: true, // Enable filtering
    filterParams: {
      textFormatter: (value) => value.replace(/\s+/g, '').toLowerCase(),
      textCustomComparator: (filter, value, filterText) => {
        // Remove spaces and convert both to lowercase for comparison
        const cleanFilterText = filterText.replace(/\s+/g, '').toLowerCase();
        const cleanValue = value.replace(/\s+/g, '').toLowerCase();
        return cleanValue.includes(cleanFilterText);
      },
      buttons:["clear"],
    },
    width: 222
  },
  {
    colId: 'fromOrganization',
    field: 'fromOrganization',
    headerName: t('txn:txnColLabels.organizationFrom'),
    minWidth: 300,
    width: 300,
    filterParams: {
      buttons:["clear"],
    }
  },
  {
    colId: 'toOrganization',
    field: 'toOrganization',
    headerName: t('txn:txnColLabels.organizationTo'),
    minWidth: 300,
    width:300,
    filterParams: {
      buttons:["clear"],
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
      buttons:["clear"],
    }
  },
  {
    colId: 'pricePerUnit',
    field: 'pricePerUnit',
    headerName: t('txn:txnColLabels.pricePerUnit'),
    valueFormatter: currencyFormatter,
    width: 190,
    valueGetter: (params) => {
      const value = params.data?.pricePerUnit;
      return value !== null && value !== undefined ? value : null;
    },
    filter: 'agNumberColumnFilter',
    filterParams: {
      buttons:["clear"],
    }
  },
  {
    colId: 'status',
    field: 'status',
    headerName: t('txn:txnColLabels.status'),
    cellRenderer: TransactionStatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCColumnSetFilter,
    floatingFilterComponentParams: {
      apiOptionField: 'status',
      apiQuery: useTransactionStatuses,
      disableCloseOnSelect: false,
      multiple: false
    },
    suppressHeaderMenuButton: true,
    minWidth: 180,
    width: 180
  },
  {
    colId: 'updateDate',
    field: 'updateDate',
    headerName: t('txn:txnColLabels.updateDate'),
    valueFormatter: dateFormatter,
    width: 190,
    filter: 'agDateColumnFilter',
    filterParams: {
      filterOptions: ['inRange', 'equals', 'lessThan', 'greaterThan'],
      defaultOption: 'inRange',
      comparator: (filterDate, cellValue) => {
          const cellDate = new Date(cellValue).setHours(0, 0, 0, 0);
          const filterDateOnly = filterDate.setHours(0, 0, 0, 0);

          if (cellDate < filterDateOnly) {
              return -1; // Cell date is before the filter date
          } else if (cellDate > filterDateOnly) {
              return 1; // Cell date is after the filter date
          } else {
              return 0; // Dates are the same (ignoring time)
          }
      },
      browserDatePicker: true, // Uses the browser's date picker if available
      buttons:["clear"],
  }
  }
]

export const defaultSortModel = [{ field: 'updateDate', direction: 'desc' }]
