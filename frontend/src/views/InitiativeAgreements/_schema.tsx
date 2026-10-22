import type { ColDef } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import {
  BCDateFloatingFilter,
  BCSelectFloatingFilter
} from '@/components/BCDataGrid/components'
import {
  useInitiativeAgreementAnalysts,
  useInitiativeAgreementStatuses
} from '@/hooks/useInitiativeAgreements'
import { DAAssignedAnalystCell } from './components/DAAssignedAnalystCell'
import { dateFormatter } from '@/utils/formatters'
import {
  InitiativeAgreementStatusRenderer,
  LastCommentRenderer
} from './components/AgreementGridRenderers'

type InitiativeAgreementGridRow = {
  lifecycleStatus?: { status?: string }
  organization?: { name?: string }
  actionNumber?: number | string
  initiativeAgreementId?: number | string
  currentStatus?: { status?: string }
  assignedAnalyst?: { userProfileId?: number | string }
  lastComment?: { fullName?: string; comment?: string }
  creditAllocation?: number | null
  [key: string]: unknown
}

// Column definitions staged for the agreements index grid (#4833). Field
// names follow the camelCase wire format of the initiative_agreement model;
// the list endpoint arrives with the agreement-management API.

// Status chip colours are provisional until the PO confirms the status
// vocabulary (statuses are seed data on initiative_agreement_status).
export const TEXT_FILTER_PARAMS = {
  filterOptions: ['contains', 'startsWith', 'equals'],
  buttons: ['clear']
}

const DATE_FILTER_PARAMS = {
  filterOptions: ['inRange', 'equals', 'lessThan', 'greaterThan'],
  defaultOption: 'inRange',
  buttons: ['clear']
}

const DATE_FLOATING_FILTER_PARAMS = {
  initialFilterType: 'equals'
}

const dateCol = (
  field: ColDef<InitiativeAgreementGridRow>['field'],
  headerName: string
): ColDef<InitiativeAgreementGridRow> => ({
  field,
  headerName,
  valueFormatter: dateFormatter,
  filter: 'agDateColumnFilter',
  filterParams: DATE_FILTER_PARAMS,
  floatingFilterComponent: BCDateFloatingFilter,
  floatingFilterComponentParams: DATE_FLOATING_FILTER_PARAMS,
  suppressFloatingFilterButton: true,
  minWidth: 140
})

// A proponent's grid holds one organization, so the column would show
// the same value in every row and its filter would filter nothing (#4893).
export const proponentInitiativeAgreementColDefs = (
  t: TFunction
): ColDef<InitiativeAgreementGridRow>[] =>
  initiativeAgreementColDefs(t).filter(
    (colDef) => colDef.field !== 'organization.name'
  )

export const initiativeAgreementColDefs = (
  t: TFunction
): ColDef<InitiativeAgreementGridRow>[] => [
  {
    field: 'lifecycleStatus.status',
    headerName: t('initiativeAgreement:columns.status'),
    cellRenderer: InitiativeAgreementStatusRenderer,
    valueGetter: (params) => params.data?.lifecycleStatus?.status,
    minWidth: 140,
    sortable: false,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'status',
      labelKey: 'status',
      optionsQuery: useInitiativeAgreementStatuses
    },
    suppressFloatingFilterButton: true
  },
  {
    field: 'organization.name',
    headerName: t('initiativeAgreement:columns.organization'),
    valueGetter: (params) => params.data?.organization?.name,
    minWidth: 200,
    filter: 'agTextColumnFilter',
    filterParams: TEXT_FILTER_PARAMS
  },
  {
    field: 'contactName',
    headerName: t('initiativeAgreement:columns.contact'),
    minWidth: 160,
    filter: 'agTextColumnFilter',
    filterParams: TEXT_FILTER_PARAMS
  },
  {
    field: 'iaCode',
    headerName: t('initiativeAgreement:columns.iaName'),
    minWidth: 150,
    filter: 'agTextColumnFilter',
    filterParams: TEXT_FILTER_PARAMS
  },
  dateCol('agreementStartDate', t('initiativeAgreement:columns.startDate')),
  dateCol('agreementEndDate', t('initiativeAgreement:columns.endDate')),
  dateCol('updateDate', t('initiativeAgreement:columns.lastUpdated')),
  {
    field: 'lastComment',
    headerName: t('initiativeAgreement:columns.comments'),
    cellRenderer: LastCommentRenderer,
    sortable: false,
    filter: false,
    minWidth: 120
  }
]

export const defaultSortModel = [{ field: 'updateDate', direction: 'desc' }]

// Column definitions for the designated actions grid on the agreement
// detail page (#4896). The ID renders as "DA{n}-IA{agreement}", matching
// the wireframe; the analyst column assigns inline for managers and
// directors and its floating filter sends the analyst's id.
// The module-wide tab (#5078) reuses the agreement grid's columns, with
// the ID read off each row's own agreement. The analyst column is shared
// too (#5197): the same cell, assignment mutation and server-side filter
// apply, since the endpoint serves the same row shape across agreements.
export const allDesignatedActionColDefs = (
  t: TFunction
): ColDef<InitiativeAgreementGridRow>[] => designatedActionColDefs(t, null)

export const designatedActionColDefs = (
  t: TFunction,
  initiativeAgreementId: number | null
): ColDef<InitiativeAgreementGridRow>[] => [
  {
    colId: 'actionNumber',
    field: 'actionNumber',
    headerName: t('initiativeAgreement:actions.columns.id'),
    // On the agreement's own grid the agreement is fixed; on the module-
    // wide tab each row carries its own.
    valueGetter: (params) =>
      `DA${params.data?.actionNumber}-IA${
        initiativeAgreementId ?? params.data?.initiativeAgreementId
      }`,
    minWidth: 120,
    filter: false
  },
  {
    field: 'name',
    headerName: t('initiativeAgreement:actions.columns.name'),
    minWidth: 240,
    flex: 1,
    filter: 'agTextColumnFilter',
    filterParams: TEXT_FILTER_PARAMS
  },
  {
    // Same source as the detail page's status chip, so the two can never
    // disagree (#4926). Sorting runs on the status's display_order server
    // side: workflow progression, not alphabet.
    colId: 'currentStatus',
    field: 'currentStatus',
    headerName: t('initiativeAgreement:actions.columns.status'),
    minWidth: 170,
    filter: false,
    valueGetter: ({ data }) => data?.currentStatus?.status || ''
  },
  {
    colId: 'assignedAnalyst',
    field: 'assignedAnalyst',
    headerName: t('initiativeAgreement:actions.columns.assignedAnalyst'),
    minWidth: 180,
    sortable: false,
    valueGetter: ({ data }) => data?.assignedAnalyst?.userProfileId ?? '',
    cellRenderer: DAAssignedAnalystCell,
    filter: 'agTextColumnFilter',
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      optionsQuery: useInitiativeAgreementAnalysts,
      valueKey: 'userProfileId',
      labelKey: 'fullName'
    },
    suppressFloatingFilterButton: true
  },
  {
    field: 'lastComment',
    headerName: t('initiativeAgreement:actions.columns.lastComment'),
    minWidth: 140,
    sortable: false,
    filter: false,
    valueGetter: ({ data }) => data?.lastComment?.fullName || '',
    cellRenderer: LastCommentRenderer
  },
  {
    field: 'creditAllocation',
    headerName: t('initiativeAgreement:actions.columns.creditsToBeIssued'),
    minWidth: 200,
    filter: false,
    valueFormatter: ({ value }) =>
      value != null
        ? t('initiativeAgreement:actions.upToCredits', {
            count: value.toLocaleString()
          })
        : '',
    valueGetter: ({ data }) => data?.creditAllocation
  },
  {
    ...dateCol(
      'updateDate',
      t('initiativeAgreement:actions.columns.lastUpdated')
    )
  }
]
