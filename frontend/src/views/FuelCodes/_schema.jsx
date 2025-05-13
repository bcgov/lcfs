import {
  CommonArrayRenderer,
  FuelCodeStatusRenderer
} from '@/utils/grid/cellRenderers'
import { numberFormatter, timezoneFormatter } from '@/utils/formatters'
import BCTypography from '@/components/BCTypography'
import { BCSelectFloatingFilter } from '@/components/BCDataGrid/components'
import { useFuelCodeStatuses, useTransportModes } from '@/hooks/useFuelCode'
import { getCode } from 'country-list'

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
    cellRenderer: FuelCodeStatusRenderer
  },
  {
    field: 'prefix',
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    suppressFloatingFilterButton: true,
    cellRenderer: (params) => {
      const prefix = params.data.fuelCodePrefix.prefix
      const countryName = params.data.fuelProductionFacilityCountry
      const countryCode = countryName ? getCode(countryName) : null

      if (!countryCode) return prefix

      // Use country flags API
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <img
            src={`https://flagcdn.com/${countryCode.toLowerCase()}.svg`}
            style={{ width: '28px', height: '24px' }}
            alt={countryName}
          />
          <span>{prefix}</span>
        </div>
      )
    },
    valueGetter: (params) => params.data.fuelCodePrefix.prefix
  },
  {
    field: 'fuelSuffix',
    headerName: t('fuelCode:fuelCodeColLabels.fuelSuffix'),
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
    type: 'numericColumn',
    filter: 'agNumberColumnFilter',
    filterParams: {
      filterOptions: ['startsWith'],
      buttons: ['clear']
    }
  },
  {
    field: 'edrms',
    headerName: t('fuelCode:fuelCodeColLabels.edrms')
  },
  {
    field: 'company',
    headerName: t('fuelCode:fuelCodeColLabels.company'),
    minWidth: 300
  },
  {
    field: 'contactName',
    headerName: t('fuelCode:fuelCodeColLabels.contactName'),
    minWidth: 300
  },
  {
    field: 'contactEmail',
    headerName: t('fuelCode:fuelCodeColLabels.contactEmail'),
    minWidth: 300
  },
  {
    field: 'applicationDate',
    headerName: t('fuelCode:fuelCodeColLabels.applicationDate'),
    filter: false
  },
  {
    field: 'approvalDate',
    headerName: t('fuelCode:fuelCodeColLabels.approvalDate'),
    filter: false
  },
  {
    field: 'effectiveDate',
    headerName: t('fuelCode:fuelCodeColLabels.effectiveDate'),
    filter: false
  },
  {
    field: 'expirationDate',
    headerName: t('fuelCode:fuelCodeColLabels.expirationDate'),
    filter: false
  },
  {
    field: 'fuelType',
    headerName: t('fuelCode:fuelCodeColLabels.fuelType'),
    valueGetter: (params) => params.data.fuelType.fuelType
  },
  {
    field: 'feedstock',
    headerName: t('fuelCode:fuelCodeColLabels.feedstock')
  },
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
    field: 'fuelProductionFacilityCity',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCity'),
    minWidth: 325
  },
  {
    field: 'fuelProductionFacilityProvinceState',
    headerName: t(
      'fuelCode:fuelCodeColLabels.fuelProductionFacilityProvinceState'
    ),
    minWidth: 325
  },
  {
    field: 'fuelProductionFacilityCountry',
    headerName: t('fuelCode:fuelCodeColLabels.fuelProductionFacilityCountry'),
    minWidth: 325
  },
  {
    field: 'facilityNameplateCapacity',
    headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacity'),
    valueFormatter: numberFormatter,
    minWidth: 290,
    type: 'numericColumn'
  },
  {
    field: 'facilityNameplateCapacityUnit',
    headerName: t('fuelCode:fuelCodeColLabels.facilityNameplateCapacityUnit'),
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
        (item) => item.feedstockFuelTransportMode?.transportMode || ''
      ) || [],
    cellRenderer: (props) => <CommonArrayRenderer {...props} />
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
        (item) => item.finishedFuelTransportMode?.transportMode || ''
      ) || [],
    cellRenderer: (props) => <CommonArrayRenderer {...props} />
  },
  {
    field: 'formerCompany',
    headerName: t('fuelCode:fuelCodeColLabels.formerCompany'),
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
    minWidth: 600
  }
]
