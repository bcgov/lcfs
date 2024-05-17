import { numberFormatter, currencyFormatter, dateFormatter } from '@/utils/formatters'
import { TransactionStatusRenderer } from '@/utils/cellRenderers'
import { BCColumnSetFilter } from '@/components/BCDataGrid/components'
import { useTransactionStatuses } from '@/hooks/useTransactions'

export const transactionsColDefs = (t) => [
  { colId: 'transactionId', field: 'transactionId', headerName: t('txn:txnColLabels.txnId'), width: 120 },
  { colId: 'transactionType', field: 'transactionType', headerName: t('txn:txnColLabels.type'), width: 150 },
  { colId: 'fromOrganization', field: 'fromOrganization', headerName: t('txn:txnColLabels.organizationFrom'), minWidth: 300, flex: 2 },
  { colId: 'toOrganization', field: 'toOrganization', headerName: t('txn:txnColLabels.organizationTo'), minWidth: 300, flex: 2 },
  {
    colId: 'quantity',
    field: 'quantity',
    headerName: t('txn:txnColLabels.quantity'),
    valueFormatter: numberFormatter,
    minWidth: 140,
    width: 140,
    type: 'rightAligned'
  },
  {
    colId: 'pricePerUnit',
    field: 'pricePerUnit',
    headerName: t('txn:txnColLabels.pricePerUnit'),
    valueFormatter: currencyFormatter,
    width: 190,
    type: 'rightAligned',
    valueGetter: (params) => params.data.pricePerUnit || '-'
  },
  {
    colId: 'status',
    field: 'status',
    headerName: t('txn:txnColLabels.status'),
    cellRenderer: TransactionStatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCColumnSetFilter,
    suppressFloatingFilterButton: true,
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
  },
];

export const defaultSortModel = [{ field: 'txnId', direction: 'asc' }]
export const defaultFilterModel = [
  { filterType: 'text', type: 'equals', field: 'isActive', filter: 'Active' }
]
