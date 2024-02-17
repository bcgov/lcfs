import { numberFormatter } from '@/utils/formatters'
import { OrgStatusRenderer } from '@/utils/cellRenderers'
import BCColumnSetFilter from '@/components/BCDataGrid/BCColumnSetFilter'
import { useOrganizationStatuses } from '@/hooks/useOrganization'

export const transactionsColDefs = (t) => [
  { colId: 'txnId', field: 'txnId', headerName: t('txn:txnColLabels.txnId'), maxWidth: 800, flex: 1 },
  { colId: 'compliancePeriod', field: 'compliancePeriod', headerName: t('txn:txnColLabels.compliancePeriod'), flex: 1 },
  { colId: 'type', field: 'type', headerName: t('txn:txnColLabels.type'), flex: 1 },
  { colId: 'complianceUnitsFrom', field: 'complianceUnitsFrom', headerName: t('txn:txnColLabels.complianceUnitsFrom'), flex: 1 },
  { colId: 'complianceUnitsTo', field: 'complianceUnitsTo', headerName: t('txn:txnColLabels.complianceUnitsTo'), flex: 1 },
  {
    colId: 'numberOfUnits',
    field: 'numberOfUnits',
    headerName: t('txn:txnColLabels.numberOfUnits'),
    valueFormatter: numberFormatter,
    flex: 1
  },
  {
    colId: 'valuePerUnit',
    field: 'valuePerUnit',
    headerName: t('txn:txnColLabels.valuePerUnit'),
    valueFormatter: numberFormatter,
    flex: 1
  },
  {
    colId: 'status',
    field: 'status',
    headerName: t('txn:txnColLabels.status'),
    cellRenderer: OrgStatusRenderer,
    cellClass: 'vertical-middle',
    floatingFilterComponent: BCColumnSetFilter,
    floatingFilterComponentParams: {
      suppressFilterButton: true,
      apiOptionField: 'status',
      apiQuery: useOrganizationStatuses,
      disableCloseOnSelect: false,
      multiple: false
    },
    suppressMenu: true,
    flex: 1
  }
];

export const defaultSortModel = [{ field: 'txnId', direction: 'asc' }]
export const defaultFilterModel = [
  { filterType: 'text', type: 'equals', field: 'is_active', filter: 'Active' }
]
