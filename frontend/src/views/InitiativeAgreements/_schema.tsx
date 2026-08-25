// @ts-nocheck
import type { ColDef } from '@ag-grid-community/core'
import BCBox from '@/components/BCBox'
import BCUserInitials from '@/components/BCUserInitials/BCUserInitials'
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
import { createStatusRenderer } from '@/utils/grid/cellRenderers'

// Column definitions staged for the agreements index grid (#4833). Field
// names follow the camelCase wire format of the initiative_agreement model;
// the list endpoint arrives with the agreement-management API.

// Status chip colours are provisional until the PO confirms the status
// vocabulary (statuses are seed data on initiative_agreement_status).
export const InitiativeAgreementStatusRenderer = createStatusRenderer(
  {
    Draft: 'info',
    Underway: 'success',
    Completed: 'primary',
    Terminated: 'warning'
  },
  { statusField: 'lifecycleStatus.status' }
)

const COMMENT_CHIP_SX = {
  bgcolor: '#606060',
  color: 'common.white',
  borderRadius: '50%',
  width: 32,
  height: 32,
  minWidth: 32,
  '& .MuiChip-label': { padding: 0 },
  '&:hover': { bgcolor: '#505050' }
}

const LastCommentRenderer = ({ data }) => {
  const last = data?.lastComment
  if (!last?.fullName) {
    return <BCBox component="div" sx={{ width: '100%', height: '100%' }} />
  }
  return (
    <BCBox
      component="div"
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 1
      }}
    >
      <BCUserInitials
        fullName={last.fullName}
        tooltipText={last.comment}
        maxLength={500}
        variant="filled"
        sx={COMMENT_CHIP_SX}
      />
    </BCBox>
  )
}

const TEXT_FILTER_PARAMS = {
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

const dateCol = (field, headerName) => ({
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

export const initiativeAgreementColDefs = (t): ColDef[] => [
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
export const designatedActionColDefs = (t, initiativeAgreementId): ColDef[] => [
  {
    colId: 'actionNumber',
    field: 'actionNumber',
    headerName: t('initiativeAgreement:actions.columns.id'),
    valueGetter: (params) =>
      `DA${params.data?.actionNumber}-IA${initiativeAgreementId}`,
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
