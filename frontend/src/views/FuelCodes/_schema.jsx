import {
  CommonArrayRenderer,
  FuelCodePrefixRenderer,
  FuelCodeStatusRenderer
} from '@/utils/grid/cellRenderers'
import {
  dateFormatter,
  numberFormatter,
  timezoneFormatter
} from '@/utils/formatters'
import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import {
  BCDateFloatingFilter,
  BCSelectFloatingFilter
} from '@/components/BCDataGrid/components'
import { useFuelCodeStatuses, useTransportModes } from '@/hooks/useFuelCode'
import { FUEL_CODE_STATUSES, getAllFuelCodeStatuses } from '@/constants/statuses'

const FuelCodeStatusBadge = (props) => {
  const statusArr = getAllFuelCodeStatuses()
  const statusIndex = statusArr.indexOf(props.data?.status)
  const statusColors = ['info', 'info', 'success', 'error']
  return (
    <BCBox sx={{ width: '100%', height: '100%' }}>
      <BCBox mt={1} sx={{ display: 'flex', justifyContent: 'center' }}>
        <BCBadge
          badgeContent={statusArr[statusIndex]}
          color={statusColors[statusIndex] ?? 'info'}
          variant="contained"
          size="lg"
          sx={{
            '& .MuiBadge-badge': {
              minWidth: '120px',
              fontWeight: 'regular',
              textTransform: 'capitalize',
              fontSize: '0.875rem',
              padding: '0.4em 0.6em'
            }
          }}
        />
      </BCBox>
    </BCBox>
  )
}

const CO_PROCESSED_OPTIONS = ['No', 'Yes - DHT', 'Yes - FCC']
const getCoProcessedOptions = () => ({
  data: CO_PROCESSED_OPTIONS.map((value) => ({ coProcessed: value })),
  isLoading: false,
  isError: false,
  error: null
})

export const fuelCodeColDefs = (t, status = null) => [
  {
    field: 'status',
    headerName: t('fuelCode:fuelCodeColLabels.status'),
    minWidth: 130,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'status',
      labelKey: 'status',
      optionsQuery: useFuelCodeStatuses
    },
    suppressFloatingFilterButton: true,
    cellRenderer: FuelCodeStatusRenderer
  },
  {
    field: 'prefix',
    minWidth: 100,
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    suppressFloatingFilterButton: true
    // cellRenderer: FuelCodePrefixRenderer,
  },
  {
    field: 'fuelSuffix',
    minWidth: 120,
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
    minWidth: 260,
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
    minWidth: 140,
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
    valueFormatter: dateFormatter,
    filter: 'agDateColumnFilter',
    minWidth: 250,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  },
  {
    field: 'approvalDate',
    headerName: t('fuelCode:fuelCodeColLabels.approvalDate'),
    valueFormatter: dateFormatter,
    filter: 'agDateColumnFilter',
    minWidth: 250,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  },
  {
    field: 'effectiveDate',
    headerName: t('fuelCode:fuelCodeColLabels.effectiveDate'),
    valueFormatter: dateFormatter,
    filter: 'agDateColumnFilter',
    minWidth: 250,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  },
  {
    field: 'expirationDate',
    headerName: t('fuelCode:fuelCodeColLabels.expirationDate'),
    valueFormatter: dateFormatter,
    filter: 'agDateColumnFilter',
    minWidth: 250,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  },
  {
    field: 'fuelType',
    minWidth: 200,
    headerName: t('fuelCode:fuelCodeColLabels.fuelType')
  },
  {
    field: 'feedstock',
    minWidth: 150,
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
    field: 'coProcessed',
    headerName: t('fuelCode:fuelCodeColLabels.coProcessed'),
    minWidth: 180,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      optionsQuery: getCoProcessedOptions,
      valueKey: 'coProcessed',
      labelKey: 'coProcessed'
    },
    suppressFloatingFilterButton: true
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
    field: 'feedstockFuelTransportModes',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockFuelTransportMode'),
    sortable: false,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'transportMode',
      labelKey: 'transportMode',
      optionsQuery: useTransportModes
    },
    suppressFloatingFilterButton: true,
    filterParams: {
      textMatcher: (filter) => true,
      suppressFilterButton: true
    },
    minWidth: 335,
    cellRenderer: (props) => (
      <CommonArrayRenderer
        {...props}
        disableLink={props.data?.status !== FUEL_CODE_STATUSES.DRAFT}
      />
    )
  },
  {
    field: 'finishedFuelTransportModes',
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
    filterParams: {
      textMatcher: (filter) => true,
      suppressFilterButton: true
    },
    cellRenderer: (props) => (
      <CommonArrayRenderer
        {...props}
        disableLink={props.data?.status !== FUEL_CODE_STATUSES.DRAFT}
      />
    )
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

export const myFuelCodeColDefs = (t) => [
  {
    field: 'status',
    headerName: t('fuelCode:fuelCodeColLabels.status'),
    minWidth: 175,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'status',
      labelKey: 'status',
      optionsQuery: useFuelCodeStatuses
    },
    suppressFloatingFilterButton: true,
    cellRenderer: FuelCodeStatusBadge
  },
  {
    field: 'prefix',
    minWidth: 200,
    headerName: t('fuelCode:fuelCodeColLabels.prefix'),
    suppressFloatingFilterButton: true
  },
  {
    field: 'fuelSuffix',
    minWidth: 120,
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
    minWidth: 260,
    headerName: t('fuelCode:fuelCodeColLabels.carbonIntensity'),
    type: 'numericColumn',
    filter: 'agNumberColumnFilter',
    filterParams: {
      filterOptions: ['startsWith'],
      buttons: ['clear']
    }
  },
  {
    field: 'applicationDate',
    headerName: t('fuelCode:fuelCodeColLabels.applicationDate'),
    valueFormatter: dateFormatter,
    filter: 'agDateColumnFilter',
    minWidth: 250,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  },
  {
    field: 'approvalDate',
    headerName: t('fuelCode:fuelCodeColLabels.approvalDate'),
    valueFormatter: dateFormatter,
    filter: 'agDateColumnFilter',
    minWidth: 250,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  },
  {
    field: 'effectiveDate',
    headerName: t('fuelCode:fuelCodeColLabels.effectiveDate'),
    valueFormatter: dateFormatter,
    filter: 'agDateColumnFilter',
    minWidth: 250,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  },
  {
    field: 'expirationDate',
    headerName: t('fuelCode:fuelCodeColLabels.expirationDate'),
    valueFormatter: dateFormatter,
    filter: 'agDateColumnFilter',
    minWidth: 250,
    floatingFilterComponent: BCDateFloatingFilter,
    suppressFloatingFilterButton: true
  },
  {
    field: 'fuelType',
    minWidth: 200,
    headerName: t('fuelCode:fuelCodeColLabels.fuelType')
  },
  {
    field: 'feedstock',
    minWidth: 250,
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
    minWidth: 400
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
    field: 'feedstockFuelTransportModes',
    headerName: t('fuelCode:fuelCodeColLabels.feedstockFuelTransportMode'),
    sortable: false,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'transportMode',
      labelKey: 'transportMode',
      optionsQuery: useTransportModes
    },
    suppressFloatingFilterButton: true,
    filterParams: {
      textMatcher: () => true,
      suppressFilterButton: true
    },
    minWidth: 335,
    cellRenderer: (props) => (
      <CommonArrayRenderer {...props} disableLink={true} />
    )
  },
  {
    field: 'finishedFuelTransportModes',
    headerName: t('fuelCode:fuelCodeColLabels.finishedFuelTransportMode'),
    sortable: false,
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      valueKey: 'transportMode',
      labelKey: 'transportMode',
      optionsQuery: useTransportModes
    },
    suppressFloatingFilterButton: true,
    filterParams: {
      textMatcher: () => true,
      suppressFilterButton: true
    },
    minWidth: 335,
    cellRenderer: (props) => (
      <CommonArrayRenderer {...props} disableLink={true} />
    )
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

export const defaultSortModel = [{ field: 'lastUpdated', direction: 'desc' }]
