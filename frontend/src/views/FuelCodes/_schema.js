import {
  LinkRenderer,
  FuelCodeStatusRenderer,
  CommonArrayRenderer
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
    valueGetter: (params) => params.data.fuelCodePrefix.prefix,
    cellRenderer: LinkRenderer
  },
  {
    field: 'fuelCode',
    headerName: t('fuelCode:fuelCodeColLabels.fuelCode'),
    cellRenderer: LinkRenderer
  },
  {
    field: 'company',
    headerName: t('fuelCode:fuelCodeColLabels.company'),
    cellRenderer: LinkRenderer,
    minWidth: 300
  },
  {
    field: 'carbonIntensity',
    headerName: t('fuelCode:fuelCodeColLabels.carbonIntensity'),
    cellRenderer: LinkRenderer,
    type: 'numericColumn'
  },
  {
    field: 'edrms',
    headerName: t('fuelCode:fuelCodeColLabels.edrms'),
    cellRenderer: LinkRenderer
  },
  {
    field: 'applicationDate',
    headerName: t('fuelCode:fuelCodeColLabels.applicationDate'),
    cellRenderer: LinkRenderer
  },
  {
    field: 'approvalDate',
    headerName: t('fuelCode:fuelCodeColLabels.approvalDate'),
    cellRenderer: LinkRenderer
  },
  {
    field: 'effectiveDate',
    headerName: t('fuelCode:fuelCodeColLabels.effectiveDate'),
    cellRenderer: LinkRenderer
  },
  {
    field: 'expirationDate',
    headerName: t('fuelCode:fuelCodeColLabels.expiryDate'),
    cellRenderer: LinkRenderer
  },
  {
    field: 'fuel',
    headerName: t('fuelCode:fuelCodeColLabels.fuel'),
    cellRenderer: LinkRenderer,
    valueGetter: (params) => params.data.fuelCodeType.fuelType
  },
  {
    field: 'feedstock',
    headerName: t('fuelCode:fuelCodeColLabels.feedstock'),
    cellRenderer: LinkRenderer
  },
  {
    field: 'feedstockLocation',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockLocation'),
    cellRenderer: LinkRenderer,
    minWidth: 300
  },
  {
    field: 'feedstockMisc',
    headerName: t('fuelCode:fuelCodeColLabels.misc'),
    cellRenderer: LinkRenderer,
    minWidth: 495
  },
  {
    field: 'fuelProductionFacilityLocation',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityLocation'),
    cellRenderer: LinkRenderer,
    minWidth: 325
  },
  {
    field: 'facilityNameplateCapacity',
    headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacity'),
    cellRenderer: LinkRenderer,
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
    cellRenderer: LinkRenderer,
    minWidth: 300
  },
  {
    field: 'lastUpdated',
    headerName: t('fuelCode:fuelCodeColLabels.lastUpdated'),
    cellRenderer: LinkRenderer
  },
  {
    field: 'notes',
    headerName: t('fuelCode:fuelCodeColLabels.notes'),
    cellRenderer: LinkRenderer,
    minWidth: 600
  }
]
