import type { ColDef } from 'ag-grid-community'
import { BCDateFloatingFilter } from '@/components/BCDataGrid/components/Filters/BCDateFloatingFilter'
import { BCSelectFloatingFilter } from '@/components/BCDataGrid/components/Filters/BCSelectFloatingFilter'
import { dateFormatter } from '@/utils/formatters'
import {
  useCIApplicationStatuses,
  useGetCIApplicationAnalysts
} from '@/hooks/useCIApplication'
import { LastCommentRenderer, CIApplicationListStatusRenderer } from './components/CIApplicationListRenderers'
import { CIAssignedAnalystCell } from './components/CIAssignedAnalystCell'

const TEXT_FILTER_PARAMS = {
  filterOptions: ['contains', 'startsWith', 'equals'],
  buttons: ['clear']
}

const NUMBER_FILTER_PARAMS = {
  filterOptions: ['equals', 'greaterThan', 'lessThan'],
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

// "Production facility Location" matches the wireframe: city + optional
// province/state, then country. We bake this in the frontend rather than on
// the API because each piece is already on the row.
const productionFacilityLocation = (data) => {
  if (!data) return ''
  const cityProvince = [data.facilityCity, data.facilityProvinceState]
    .filter(Boolean)
    .join(' ')
    .trim()
  const country = (data.facilityCountry || '').trim()
  if (cityProvince && country) return `${cityProvince}, ${country}`
  return cityProvince || country
}

const statusCol = (t) => ({
  field: 'status.status',
  headerName: t('carbonIntensity:columns.status'),
  cellRenderer: CIApplicationListStatusRenderer,
  valueGetter: (params) => params.data?.status?.status,
  minWidth: 140,
  sortable: false,
  floatingFilterComponent: BCSelectFloatingFilter,
  floatingFilterComponentParams: {
    valueKey: 'status',
    labelKey: 'status',
    optionsQuery: useCIApplicationStatuses
  },
  suppressFloatingFilterButton: true
})

const idCol = (t) => ({
  field: 'ciApplicationId',
  headerName: t('carbonIntensity:columns.ciApplicationId'),
  valueFormatter: (params) => `CI${params.value}`,
  filterValueGetter: (params) => `CI${params.data?.ciApplicationId ?? ''}`,
  minWidth: 150,
  maxWidth: 220,
  sortable: true,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

const proposedEffectiveCol = (t) => ({
  field: 'proposedFuelCodeEffectiveDate',
  headerName: t('carbonIntensity:columns.proposedEffectiveDate'),
  minWidth: 300,
  valueFormatter: dateFormatter,
  filter: 'agDateColumnFilter',
  filterParams: DATE_FILTER_PARAMS,
  floatingFilterComponent: BCDateFloatingFilter,
  floatingFilterComponentParams: DATE_FLOATING_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

// Single composite column replacing the previous Country / City / Capacity
// trio so we match the wireframe layout. Filterable by free text against
// the displayed string.
const productionFacilityLocationCol = (t) => ({
  field: 'productionFacilityLocation',
  headerName: t('carbonIntensity:columns.productionFacilityLocation'),
  valueGetter: ({ data }) => productionFacilityLocation(data),
  minWidth: 330,
  sortable: false,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

const lastUpdatedCol = (t) => ({
  field: 'updateDate',
  headerName: t('carbonIntensity:columns.lastUpdated'),
  minWidth: 300,
  valueFormatter: dateFormatter,
  sort: 'desc',
  filter: 'agDateColumnFilter',
  filterParams: DATE_FILTER_PARAMS,
  floatingFilterComponent: BCDateFloatingFilter,
  floatingFilterComponentParams: DATE_FLOATING_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

const organizationCol = (t) => ({
  field: 'organization.name',
  headerName: t('carbonIntensity:columns.organization'),
  valueGetter: (params) => params.data?.organization?.name,
  minWidth: 330,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

// IDIR triage columns. Backed by simple nullable columns on the
// ci_application table; filterable via the standard pipeline.
const priorityScoreCol = (t) => ({
  field: 'priorityScore',
  headerName: t('carbonIntensity:columns.priorityScore'),
  minWidth: 180,
  type: 'numericColumn',
  filter: 'agNumberColumnFilter',
  filterParams: NUMBER_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

export const getVerificationColumnValue = (data) => {
  if (data?.verification2Date) return 'VX2'
  if (data?.verification1Date) return 'VX1'
  if (['VX1', 'VX2'].includes(data?.verificationLevel)) {
    return data.verificationLevel
  }
  return null
}

const verificationCol = (t) => ({
  field: 'verificationLevel',
  headerName: t('carbonIntensity:columns.verification'),
  valueGetter: ({ data }) => getVerificationColumnValue(data),
  minWidth: 220,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

const assignedAnalystCol = (t, onRefresh) => ({
  field: 'assignedAnalyst',
  headerName: t('carbonIntensity:columns.assignedAnalyst'),
  minWidth: 180,
  valueGetter: ({ data }) => data?.assignedAnalyst?.initials || '',
  cellRenderer: CIAssignedAnalystCell,
  cellRendererParams: {
    onRefresh
  },
  sortable: false,
  filter: 'agTextColumnFilter',
  filterParams: {
    textFormatter: (value) => value || '',
    textCustomComparator: (filter, value, filterText) => {
      // Handle filtering by initials
      const cleanValue = (value || '').toLowerCase()
      const cleanFilter = filterText.toLowerCase()
      return cleanValue.includes(cleanFilter)
    },
    buttons: ['clear']
  },
  floatingFilterComponent: BCSelectFloatingFilter,
  floatingFilterComponentParams: {
    optionsQuery: useGetCIApplicationAnalysts,
    valueKey: 'initials',
    labelKey: 'fullName'
  },
  suppressFloatingFilterButton: true,
  suppressHeaderFilterButton: true
})

const lastCommentCol = (t) => ({
  field: 'lastComment',
  headerName: t('carbonIntensity:columns.lastComment'),
  minWidth: 220,
  valueGetter: ({ data }) => data?.lastComment?.comment || '',
  cellRenderer: LastCommentRenderer,
  sortable: false,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

/**
 * Column definitions for the CI applications list, ordered to match the
 * UXPin wireframes.
 *
 * BCeID view (5 cols):
 *   Status, ID, Proposed effective date, Production facility Location, Last updated
 *
 * IDIR view (10 cols):
 *   Status, ID, Organization, Priority score, Verification,
 *   Assigned analyst, Last comment, Proposed effective date,
 *   Production facility Location, Last updated
 *
 * Priority score and Verification are backed by simple nullable columns
 * on ci_application. The verification taxonomy (VX1/VX2 + Low/Moderate/
 * High) isn't formalised yet, so it's stored as free text for now and
 * filterable by string contains; tighten to an enum / FK lookup once
 * the verification workflow is specced.
 */
export const ciApplicationsColDefs = (
  t: (key: string) => string,
  {
    isGovernment = false,
    onRefresh
  }: { isGovernment?: boolean; onRefresh?: () => void } = {}
): ColDef[] => {
  if (!isGovernment) {
    return [
      statusCol(t),
      idCol(t),
      proposedEffectiveCol(t),
      productionFacilityLocationCol(t),
      lastUpdatedCol(t)
    ]
  }
  return [
    statusCol(t),
    idCol(t),
    organizationCol(t),
    priorityScoreCol(t),
    verificationCol(t),
    assignedAnalystCol(t, onRefresh),
    lastCommentCol(t),
    proposedEffectiveCol(t),
    productionFacilityLocationCol(t),
    lastUpdatedCol(t)
  ]
}

export const defaultSortModel: Array<{ field: string; direction: string }> = [
  { field: 'updateDate', direction: 'desc' }
]

/**
 * Map an application's status to the wizard step number (1-indexed) the user
 * should land on when they re-open the row from the list.
 *
 * Step 1 is implicitly completed by the time the row exists (creating the
 * draft requires the Step 1 fields), so Drafts resume at Step 2. Once
 * submitted, the applicant is past the editable steps and should land on
 * the Government decision panel.
 */
export const getResumeStep = (
  application: { status?: { status?: string } } | null | undefined
): number => {
  const status = application?.status?.status
  switch (status) {
    case 'Draft':
      return 2
    case 'Submitted':
    case 'Recommended':
    case 'Completed':
    case 'Withdrawn':
      return 5
    default:
      return 1
  }
}
