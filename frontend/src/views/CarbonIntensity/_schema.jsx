import { Box, Chip, Tooltip } from '@mui/material'

import BCBox from '@/components/BCBox'
import BCUserInitials from '@/components/BCUserInitials/BCUserInitials'
import {
  BCDateFloatingFilter,
  BCSelectFloatingFilter
} from '@/components/BCDataGrid/components'
import { dateFormatter } from '@/utils/formatters'
import { useCIApplicationStatuses } from '@/hooks/useCIApplication'

const ANALYST_CHIP_SX = {
  bgcolor: '#606060',
  color: 'common.white',
  borderRadius: '50%',
  width: 32,
  height: 32,
  minWidth: 32,
  '& .MuiChip-label': { padding: 0 },
  '&:hover': { bgcolor: '#505050' }
}

// Centered chip wrapper so analyst / last-comment pills sit visually
// centered in their grid cell regardless of the row's natural height.
const PillCell = ({ children }) => (
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
    {children}
  </BCBox>
)

const AssignedAnalystRenderer = ({ data }) => {
  const analyst = data?.assignedAnalyst
  if (!analyst?.initials) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span>-</span>
      </Box>
    )
  }
  return (
    <PillCell>
      <Tooltip
        title={analyst.fullName || `${analyst.firstName || ''} ${analyst.lastName || ''}`.trim()}
      >
        <Chip label={analyst.initials} size="small" sx={ANALYST_CHIP_SX} />
      </Tooltip>
    </PillCell>
  )
}

const LastCommentRenderer = ({ data }) => {
  const last = data?.lastComment
  if (!last?.fullName) {
    return <BCBox component="div" sx={{ width: '100%', height: '100%' }} />
  }
  return (
    <PillCell>
      <BCUserInitials
        fullName={last.fullName}
        tooltipText={last.comment}
        maxLength={500}
        variant="filled"
        sx={ANALYST_CHIP_SX}
      />
    </PillCell>
  )
}

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
  minWidth: 90,
  maxWidth: 110,
  sortable: true,
  filter: 'agNumberColumnFilter',
  filterParams: NUMBER_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

const proposedEffectiveCol = (t) => ({
  field: 'proposedFuelCodeEffectiveDate',
  headerName: t('carbonIntensity:columns.proposedEffectiveDate'),
  minWidth: 180,
  valueFormatter: dateFormatter,
  filter: 'agDateColumnFilter',
  filterParams: DATE_FILTER_PARAMS,
  floatingFilterComponent: BCDateFloatingFilter,
  suppressFloatingFilterButton: true
})

// Single composite column replacing the previous Country / City / Capacity
// trio so we match the wireframe layout. Filterable by free text against
// the displayed string.
const productionFacilityLocationCol = (t) => ({
  field: 'productionFacilityLocation',
  headerName: t('carbonIntensity:columns.productionFacilityLocation'),
  valueGetter: ({ data }) => productionFacilityLocation(data),
  minWidth: 220,
  sortable: false,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

const lastUpdatedCol = (t) => ({
  field: 'updateDate',
  headerName: t('carbonIntensity:columns.lastUpdated'),
  minWidth: 180,
  valueFormatter: dateFormatter,
  sort: 'desc',
  filter: 'agDateColumnFilter',
  filterParams: DATE_FILTER_PARAMS,
  floatingFilterComponent: BCDateFloatingFilter,
  suppressFloatingFilterButton: true
})

const organizationCol = (t) => ({
  field: 'organization.name',
  headerName: t('carbonIntensity:columns.organization'),
  valueGetter: (params) => params.data?.organization?.name,
  minWidth: 220,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

// IDIR triage columns. Backed by simple nullable columns on the
// ci_application table; filterable via the standard pipeline.
const priorityScoreCol = (t) => ({
  field: 'priorityScore',
  headerName: t('carbonIntensity:columns.priorityScore'),
  minWidth: 140,
  type: 'numericColumn',
  filter: 'agNumberColumnFilter',
  filterParams: NUMBER_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

const verificationCol = (t) => ({
  field: 'verificationLevel',
  headerName: t('carbonIntensity:columns.verification'),
  minWidth: 160,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS,
  suppressFloatingFilterButton: true
})

const assignedAnalystCol = (t) => ({
  field: 'assignedAnalyst',
  headerName: t('carbonIntensity:columns.assignedAnalyst'),
  minWidth: 170,
  valueGetter: ({ data }) => data?.assignedAnalyst?.initials || '',
  cellRenderer: AssignedAnalystRenderer,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS,
  suppressFloatingFilterButton: true,
  sortable: false
})

const lastCommentCol = (t) => ({
  field: 'lastComment',
  headerName: t('carbonIntensity:columns.lastComment'),
  minWidth: 150,
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
export const ciApplicationsColDefs = (t, { isGovernment = false } = {}) => {
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
    assignedAnalystCol(t),
    lastCommentCol(t),
    proposedEffectiveCol(t),
    productionFacilityLocationCol(t),
    lastUpdatedCol(t)
  ]
}

export const defaultSortModel = [{ field: 'updateDate', direction: 'desc' }]

/**
 * Map an application's status to the wizard step number (1-indexed) the user
 * should land on when they re-open the row from the list.
 *
 * Step 1 is implicitly completed by the time the row exists (creating the
 * draft requires the Step 1 fields), so Drafts resume at Step 2. Once
 * submitted, the applicant is past the editable steps and should land on
 * the Government decision panel.
 */
export const getResumeStep = (application) => {
  const status = application?.status?.status
  switch (status) {
    case 'Draft':
      return 2
    case 'Submitted':
    case 'Completed':
    case 'Withdrawn':
      return 5
    default:
      return 1
  }
}
