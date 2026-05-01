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
