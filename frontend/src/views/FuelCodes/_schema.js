import {
  LinkRenderer,
  FuelCodeStatusRenderer,
  CommonArrayRenderer,
} from '@/utils/cellRenderers'

export const fuelCodeColDefs = (t) => [
  {
    field: 'status',
    headerName: t('fuelCode:fuelCodeColLabels.status'),
    valueGetter: (params) => params.data.fuelCodeStatus.status,
    cellRenderer: FuelCodeStatusRenderer
  },
  {
    field: 'prefix',
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    valueGetter: (params) => params.data.fuelCodePrefix.prefix
  },
  { field: 'fuelCode', headerName: t('fuelCode:fuelCodeColLabels.fuelCode') },
  {
    field: 'company',
    headerName: t('fuelCode:fuelCodeColLabels.company'),
    minWidth: 300
  },
  {
    field: 'carbonIntensity',
    headerName: t('fuelCode:fuelCodeColLabels.carbonIntensity'),
    type: 'numericColumn'
  },
  { field: 'edrms', headerName: t('fuelCode:fuelCodeColLabels.edrms') },
  {
    field: 'applicationDate',
    headerName: t('fuelCode:fuelCodeColLabels.applicationDate')
  },
  {
    field: 'approvalDate',
    headerName: t('fuelCode:fuelCodeColLabels.approvalDate')
  },
  {
    field: 'effectiveDate',
    headerName: t('fuelCode:fuelCodeColLabels.effectiveDate')
  },
  {
    field: 'expirationDate',
    headerName: t('fuelCode:fuelCodeColLabels.expiryDate')
  },
  {
    field: 'fuel',
    headerName: t('fuelCode:fuelCodeColLabels.fuel'),
    valueGetter: (params) => params.data.fuelCodeType.fuelType
  },
  { field: 'feedstock', headerName: t('fuelCode:fuelCodeColLabels.feedstock') },
  {
    field: 'feedstockLocation',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockLocation'),
    minWidth: 300
  },
  {
    field: 'feedstockMisc',
    headerName: t('fuelCode:fuelCodeColLabels.misc'),
    minWidth: 495
  },
  {
    field: 'fuelProductionFacilityLocation',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityLocation'),
    minWidth: 325
  },
  {
    field: 'facilityNameplateCapacity',
    headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacity'),
    minWidth: 290,
    type: 'numericColumn'
  },
  {
    field: 'feedstockTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockTransportMode'),
    minWidth: 300,
    valueGetter: (params) =>
      params.data.feedstockFuelTransportModes.map(
        (item) => item.feedstockFuelTransportMode.transportMode
      ),
    cellRenderer: CommonArrayRenderer
  },
  {
    field: 'finishedFuelTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.finishedFuelTransportMode'),
    minWidth: 300,
    valueGetter: (params) =>
      params.data.finishedFuelTransportModes.map(
        (item) => item.finishedFuelTransportMode.transportMode
      ),
    cellRenderer: CommonArrayRenderer
  },
  {
    field: 'formerCompany',
    headerName: t('fuelCode:fuelCodeColLabels.formerCompany'),
    minWidth: 300
  },
  {
    field: 'lastUpdated',
    headerName: t('fuelCode:fuelCodeColLabels.lastUpdated')
  },
  {
    field: 'notes',
    headerName: t('fuelCode:fuelCodeColLabels.notes'),
    minWidth: 600
  }
]
