import { BCSelectFloatingFilter } from '@/components/BCDataGrid/components'

export const DEFAULT_QUANTITY = 100000

const textFilter = {
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  filterParams: {
    filterOptions: ['contains'],
    maxNumConditions: 1
  }
}

const createSelectFilter = (options = []) => ({
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  floatingFilterComponent: BCSelectFloatingFilter,
  floatingFilterComponentParams: {
    optionsQuery: () => ({ data: options, isLoading: false }),
    valueKey: 'name',
    labelKey: 'name',
    initialFilterType: 'equals'
  },
  filterParams: {
    filterOptions: ['equals'],
    maxNumConditions: 1
  }
})

const numberFilter = {
  filter: 'agNumberColumnFilter',
  floatingFilter: true,
  filterParams: {
    filterOptions: ['equals', 'lessThan', 'greaterThan', 'inRange'],
    maxNumConditions: 1
  }
}

const getHeader = (t, key, fallback) => {
  return typeof t === 'function' ? t(key, fallback) : fallback
}

export const createLookupTableColumnDefs = (filterOptions = {}, t) => [
  {
    field: 'compliance_units',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.complianceUnits',
      'Compliance units'
    ),
    type: 'numericColumn',
    width: 225,
    sortable: true,
    ...numberFilter,
    valueGetter: (params) => {
      const { targetCi, eer, ciOfFuel, uci, energyDensity } = params.data
      if (
        !targetCi ||
        !eer ||
        ciOfFuel === null ||
        ciOfFuel === undefined ||
        !energyDensity
      )
        return 'N/A'
      const energyContent = DEFAULT_QUANTITY * energyDensity
      const complianceUnits = Math.round(
        ((targetCi * eer - (ciOfFuel + (uci || 0))) * energyContent) / 1000000
      )
      return complianceUnits
    },
    valueFormatter: (params) =>
      params.value === 'N/A'
        ? 'N/A'
        : params.value
          ? params.value.toLocaleString()
          : '0'
  },
  {
    field: 'quantity_supplied',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.quantitySupplied',
      'Quantity supplied'
    ),
    type: 'numericColumn',
    width: 225,
    sortable: true,
    ...numberFilter,
    valueGetter: () => DEFAULT_QUANTITY,
    valueFormatter: (params) => params.value.toLocaleString()
  },
  {
    field: 'units',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.units',
      'Units'
    ),
    minWidth: 220,
    sortable: true,
    ...textFilter,
    valueGetter: (params) => {
      const unit = params.data.energyDensityUnit
      return unit ? unit.replace('MJ/', '') : 'N/A'
    }
  },
  {
    field: 'fuelType',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.fuelType',
      'Fuel type'
    ),
    width: 220,
    sortable: true,
    ...createSelectFilter(filterOptions.fuelType)
  },
  {
    field: 'fuelCategory',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.fuelCategory',
      'Fuel category'
    ),
    width: 200,
    sortable: true,
    ...createSelectFilter(filterOptions.fuelCategory)
  },
  {
    field: 'endUse',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.endUse',
      'End use'
    ),
    width: 400,
    sortable: true,
    ...createSelectFilter(filterOptions.endUse),
    valueFormatter: (params) => params.value || 'N/A'
  },
  {
    field: 'determiningCarbonIntensity',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.determiningCarbonIntensity',
      'Determining carbon intensity'
    ),
    width: 400,
    sortable: true,
    ...createSelectFilter(filterOptions.determiningCarbonIntensity)
  },
  {
    field: 'targetCi',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.targetCi',
      'Target CI'
    ),
    type: 'numericColumn',
    width: 150,
    sortable: true,
    ...numberFilter,
    valueFormatter: (params) =>
      params.value !== null && params.value !== undefined
        ? params.value.toFixed(2)
        : 'N/A'
  },
  {
    field: 'ciOfFuel',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.ciOfFuel',
      'CI of fuel'
    ),
    type: 'numericColumn',
    width: 150,
    sortable: true,
    ...numberFilter,
    valueFormatter: (params) =>
      params.value !== null && params.value !== undefined
        ? params.value.toFixed(2)
        : 'N/A'
  },
  {
    field: 'uci',
    headerName: getHeader(t, 'common:publicCalculator.tableHeaders.uci', 'UCI'),
    type: 'numericColumn',
    width: 150,
    sortable: true,
    ...numberFilter,
    valueFormatter: (params) =>
      params.value !== null && params.value !== undefined
        ? params.value.toFixed(2)
        : 'N/A'
  },
  {
    field: 'energyDensity',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.energyDensity',
      'Energy density'
    ),
    type: 'numericColumn',
    width: 200,
    sortable: true,
    ...numberFilter,
    valueFormatter: (params) =>
      params.data.energyDensity !== null &&
      params.data.energyDensity !== undefined
        ? params.data.energyDensity.toFixed(2)
        : 'N/A'
  },
  {
    field: 'eer',
    headerName: getHeader(t, 'common:publicCalculator.tableHeaders.eer', 'EER'),
    type: 'numericColumn',
    width: 150,
    sortable: true,
    ...numberFilter,
    valueFormatter: (params) =>
      params.value !== null && params.value !== undefined
        ? params.value.toFixed(2)
        : 'N/A'
  },
  {
    field: 'energy_content',
    headerName: getHeader(
      t,
      'common:publicCalculator.tableHeaders.energyContent',
      'Energy content (MJ)'
    ),
    type: 'numericColumn',
    width: 250,
    sortable: true,
    ...numberFilter,
    valueGetter: (params) => {
      const energyDensity = params.data.energyDensity
      if (!energyDensity) return 'N/A'
      return DEFAULT_QUANTITY * energyDensity
    },
    valueFormatter: (params) =>
      params.value === 'N/A'
        ? 'N/A'
        : params.value
          ? params.value.toLocaleString()
          : '0'
  }
]

export const lookupTableColumnDefs = createLookupTableColumnDefs()
