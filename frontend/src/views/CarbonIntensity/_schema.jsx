import { dateFormatter, numberFormatter } from '@/utils/formatters'

export const ciApplicationsColDefs = (t) => [
  {
    field: 'ciApplicationId',
    headerName: t('carbonIntensity:columns.ciApplicationId'),
    minWidth: 80,
    maxWidth: 110,
    sortable: true
  },
  {
    field: 'status.status',
    headerName: t('carbonIntensity:columns.status'),
    valueGetter: (params) => params.data?.status?.status,
    minWidth: 130,
    sortable: false
  },
  {
    field: 'facilityCountry',
    headerName: t('carbonIntensity:columns.facilityCountry'),
    minWidth: 140
  },
  {
    field: 'facilityCity',
    headerName: t('carbonIntensity:columns.facilityCity'),
    minWidth: 140
  },
  {
    field: 'facilityNameplateCapacity',
    headerName: t('carbonIntensity:columns.facilityCapacity'),
    minWidth: 160,
    valueFormatter: (p) => (p?.value != null ? numberFormatter(p) : '')
  },
  {
    field: 'proposedFuelCodeEffectiveDate',
    headerName: t('carbonIntensity:columns.proposedEffectiveDate'),
    minWidth: 170,
    valueFormatter: dateFormatter
  },
  {
    field: 'updateDate',
    headerName: t('carbonIntensity:columns.lastUpdated'),
    minWidth: 170,
    valueFormatter: dateFormatter,
    sort: 'desc'
  }
]

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
