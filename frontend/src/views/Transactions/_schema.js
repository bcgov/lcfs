import { 
  numberFormatter, 
  currencyFormatter, 
  dateFormatter, 
  spacesFormatter 
} from '@/utils/formatters'
import { TransactionStatusRenderer } from '@/utils/cellRenderers'
import { BCColumnSetFilter } from '@/components/BCDataGrid/components'
import { useTransactionStatuses } from '@/hooks/useTransactions'

const prefixMap = {
  "Transfer": "CUT",
  "AdminAdjustment": "AA",
  "InitiativeAgreement": "IA"
};

export const transactionsColDefs = (t) => [
  { 
    colId: 'transactionId', 
    field: 'transactionId', 
    headerName: t('txn:txnColLabels.txnId'), 
    width: 175,
    valueGetter: (params) => {
      const transactionType = params.data.transactionType;
      const prefix = prefixMap[transactionType] || '';
      return `${prefix}${params.data.transactionId}`;
    }
  },
  { 
    colId: 'transactionType', 
    field: 'transactionType', 
    headerName: t('txn:txnColLabels.type'), 
    valueFormatter: spacesFormatter,
    width: 222 
  },
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

export const defaultSortModel = [{ field: 'createDate', direction: 'desc' }]

// Filters
export const filterInProgressOrgTransfers = [
  { filterType: 'text', type: 'equals', field: 'transactionType', filter: 'Transfer' },
  { filterType: 'set', type: 'set', field: 'status', filter: ['Draft', 'Sent', 'Submitted'] }
]
export const filterInProgressTransfers = [
  { filterType: 'text', type: 'equals', field: 'transactionType', filter: 'Transfer' },
  { filterType: 'set', type: 'set', field: 'status', filter: ['Submitted', 'Recommended'] }
]
export const filterInProgressInitiativeAgreements = [
  { filterType: 'text', type: 'equals', field: 'transactionType', filter: 'InitiativeAgreement' },
  { filterType: 'set', type: 'set', field: 'status', filter: ['Draft', 'Recommended'] }
]
export const filterInProgressAdminAdjustments = [
  { filterType: 'text', type: 'equals', field: 'transactionType', filter: 'AdminAdjustment' },
  { filterType: 'set', type: 'set', field: 'status', filter: ['Draft', 'Recommended'] }
]
