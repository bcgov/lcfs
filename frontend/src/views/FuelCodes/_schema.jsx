import {
  CommonArrayRenderer,
  FuelCodeStatusTextRenderer,
  TextRenderer
} from '@/utils/grid/cellRenderers'
import { numberFormatter, timezoneFormatter } from '@/utils/formatters'
import BCTypography from '@/components/BCTypography'
import {
  BCSelectFloatingFilter,
  BCDateFloatingFilter
} from '@/components/BCDataGrid/components'
import { useFuelCodeStatuses, useTransportModes } from '@/hooks/useFuelCode'

export const fuelCodeColDefs = (t) => [
  {
    field: 'status',
    headerName: t('fuelCode:fuelCodeColLabels.status'),
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'status',
      labelKey: 'status',
      optionsQuery: useFuelCodeStatuses
    },
    suppressFloatingFilterButton: true,
    valueGetter: (params) => params.data.fuelCodeStatus.status,
    cellRenderer: FuelCodeStatusTextRenderer
  },
  {
    field: 'prefix',
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    valueGetter: (params) => params.data.fuelCodePrefix.prefix,
    suppressFloatingFilterButton: true,
    cellRenderer: TextRenderer
  },
  {
    field: 'fuelSuffix',
    headerName: t('fuelCode:fuelCodeColLabels.fuelSuffix'),
    cellRenderer: TextRenderer,
    type: 'numericColumn',
    filter: 'agNumberColumnFilter',
    suppressFloatingFilterButton: true,
    filterParams: {
      filterOptions: ['startsWith'],
      buttons: ['clear']
    }
  },
  {
    field: 'carbonIntensity',
    headerName: t('fuelCode:fuelCodeColLabels.carbonIntensity'),
    cellRenderer: TextRenderer,
    type: 'numericColumn',
    filter: 'agNumberColumnFilter',
    filterParams: {
      filterOptions: ['startsWith'],
      buttons: ['clear']
    }
  },
  {
    field: 'edrms',
    headerName: t('fuelCode:fuelCodeColLabels.edrms'),
    cellRenderer: TextRenderer
  },
  {
    field: 'company',
    headerName: t('fuelCode:fuelCodeColLabels.company'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'contactName',
    headerName: t('fuelCode:fuelCodeColLabels.contactName'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'contactEmail',
    headerName: t('fuelCode:fuelCodeColLabels.contactEmail'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'applicationDate',
    headerName: t('fuelCode:fuelCodeColLabels.applicationDate'),
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true,
    minWidth: 250,
    cellRenderer: TextRenderer
  },
  {
    field: 'approvalDate',
    headerName: t('fuelCode:fuelCodeColLabels.approvalDate'),
    cellRenderer: TextRenderer,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true,
    minWidth: 250
  },
  {
    field: 'effectiveDate',
    headerName: t('fuelCode:fuelCodeColLabels.effectiveDate'),
    cellRenderer: TextRenderer,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true,
    minWidth: 250
  },
  {
    field: 'expirationDate',
    headerName: t('fuelCode:fuelCodeColLabels.expirationDate'),
    cellRenderer: TextRenderer,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true,
    minWidth: 250
  },
  {
    field: 'fuelType',
    headerName: t('fuelCode:fuelCodeColLabels.fuelType'),
    cellRenderer: TextRenderer,
    valueGetter: (params) => params.data.fuelType.fuelType
  },
  {
    field: 'feedstock',
    headerName: t('fuelCode:fuelCodeColLabels.feedstock'),
    cellRenderer: TextRenderer
  },
  {
    field: 'feedstockLocation',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockLocation'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'feedstockMisc',
    headerName: t('fuelCode:fuelCodeColLabels.misc'),
    cellRenderer: TextRenderer,
    minWidth: 495
  },
  {
    field: 'fuelProductionFacilityCity',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCity'),
    cellRenderer: TextRenderer,
    minWidth: 325
  },
  {
    field: 'fuelProductionFacilityProvinceState',
    headerName: t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
    ),
    cellRenderer: TextRenderer,
    minWidth: 325
  },
  {
    field: 'fuelProductionFacilityCountry',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry'),
    cellRenderer: TextRenderer,
    minWidth: 325
  },
  {
    field: 'facilityNameplateCapacity',
    headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacity'),
    valueFormatter: numberFormatter,
    cellRenderer: TextRenderer,
    minWidth: 290,
    type: 'numericColumn'
  },
  {
    field: 'facilityNameplateCapacityUnit',
    headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacityUnit'),
    cellRenderer: TextRenderer,
    minWidth: 290
  },
  {
    field: 'feedstockFuelTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockFuelTransportMode'),
    sortable: false,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'transportMode',
      labelKey: 'transportMode',
      optionsQuery: useTransportModes
    },
    suppressFloatingFilterButton: true,
    minWidth: 335,
    valueGetter: (params) =>
      params.data.feedstockFuelTransportModes.map(
        (item) => item.feedstockFuelTransportMode.transportMode
      ),
    cellRenderer: (props) => <CommonArrayRenderer disableLink {...props} />
  },
  {
    field: 'finishedFuelTransportMode',
    headerName: t('fuelCode:fuelCodeColLabels.finishedFuelTransportMode'),
    sortable: false,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'transportMode',
      labelKey: 'transportMode',
      optionsQuery: useTransportModes
    },
    suppressFloatingFilterButton: true,
    minWidth: 335,
    valueGetter: (params) =>
      params.data.finishedFuelTransportModes.map(
        (item) => item.finishedFuelTransportMode.transportMode
      ),
    cellRenderer: (props) => <CommonArrayRenderer disableLink {...props} />
  },
  {
    field: 'formerCompany',
    headerName: t('fuelCode:fuelCodeColLabels.formerCompany'),
    cellRenderer: TextRenderer,
    minWidth: 300
  },
  {
    field: 'lastUpdated',
    filter: false,
    headerName: t('fuelCode:fuelCodeColLabels.lastUpdated'),
    cellRenderer: (params) => (
      <BCTypography variant="body4">
        {params.value
          ? timezoneFormatter({ value: params.value })
          : 'YYYY-MM-DD'}
      </BCTypography>
    ),
    minWidth: 300
  },
  {
    field: 'notes',
    headerName: t('fuelCode:fuelCodeColLabels.notes'),
    cellRenderer: TextRenderer,
    minWidth: 600
  }
]
