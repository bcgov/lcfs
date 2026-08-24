// @ts-nocheck
import type { ColDef } from '@ag-grid-community/core'
import BCBox from '@/components/BCBox'
import BCUserInitials from '@/components/BCUserInitials/BCUserInitials'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components'
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
  { statusField: 'currentStatus.status' }
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
    field: 'currentStatus.status',
    headerName: t('initiativeAgreement:columns.status'),
    cellRenderer: InitiativeAgreementStatusRenderer,
    valueGetter: (params) => params.data?.currentStatus?.status,
    minWidth: 140,
    filter: 'agTextColumnFilter',
    filterParams: TEXT_FILTER_PARAMS
    // TODO(#4833): swap to BCSelectFloatingFilter once the statuses
    // endpoint exists
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
