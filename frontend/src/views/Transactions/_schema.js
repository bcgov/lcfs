import { numberFormatter, currencyFormatter, dateFormatter } from '@/utils/formatters'
import { TransactionStatusRenderer } from '@/utils/cellRenderers'
import BCColumnSetFilter from '@/components/BCDataGrid/BCColumnSetFilter'
import { useTransactionStatuses } from '@/hooks/useTransactions'

export const transactionsColDefs = (t) => [
  { colId: 'transaction_id', field: 'transaction_id', headerName: t('txn:txnColLabels.txnId'), maxWidth: 120 },
  { colId: 'transaction_type', field: 'transaction_type', headerName: t('txn:txnColLabels.type'), maxWidth: 150 },
  { colId: 'from_organization', field: 'from_organization', headerName: t('txn:txnColLabels.organizationFrom'), flex: 2 },
  { colId: 'to_organization', field: 'to_organization', headerName: t('txn:txnColLabels.organizationTo'), flex: 2 },
  {
    colId: 'quantity',
    field: 'quantity',
    headerName: t('txn:txnColLabels.quantity'),
    valueFormatter: numberFormatter,
    maxWidth: 190,
  },
  {
    colId: 'price_per_unit',
    field: 'price_per_unit',
    headerName: t('txn:txnColLabels.pricePerUnit'),
    valueFormatter: currencyFormatter,
    maxWidth: 190,
  },
  {
    colId: 'status',
    field: 'status',
    headerName: t('txn:txnColLabels.status'),
    cellRenderer: TransactionStatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCColumnSetFilter,
    floatingFilterComponentParams: {
      suppressFilterButton: true,
      apiOptionField: 'status',
      apiQuery: useTransactionStatuses,
      disableCloseOnSelect: false,
      multiple: false
    },
    suppressMenu: true,
    maxWidth: 190
  },
  {
    colId: 'update_date',
    field: 'update_date',
    headerName: t('txn:txnColLabels.updateDate'),
    valueFormatter: dateFormatter,
    maxWidth: 180,
  },
];

export const defaultSortModel = [{ field: 'txnId', direction: 'asc' }]
export const defaultFilterModel = [
  { filterType: 'text', type: 'equals', field: 'is_active', filter: 'Active' }
]
