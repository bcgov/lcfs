export const DEFAULT_QUANTITY = 100000

export const lookupTableColumnDefs = [
  {
    field: 'compliance_units',
    headerName: 'Compliance units',
    type: 'numericColumn',
    width: 225,
    sortable: true,
    valueGetter: (params) => {
      const { targetCi, eer, ciOfFuel, uci, energyDensity } = params.data
      if (!targetCi || !eer || ciOfFuel === null || ciOfFuel === undefined || !energyDensity) return 'N/A'
      const energyContent = DEFAULT_QUANTITY * energyDensity
      const complianceUnits = Math.round(
        ((targetCi * eer - (ciOfFuel + (uci || 0))) * energyContent) / 1000000
      )
      return complianceUnits
    },
    valueFormatter: (params) => 
      params.value === 'N/A' ? 'N/A' : (params.value ? params.value.toLocaleString() : '0')
  },
  {
    field: 'quantity_supplied',
    headerName: 'Quantity supplied',
    type: 'numericColumn',
    width: 225,
    sortable: true,
    valueGetter: () => DEFAULT_QUANTITY,
    valueFormatter: (params) => params.value.toLocaleString()
  },
  {
    field: 'units',
    headerName: 'Units',
    width: 120,
    sortable: true,
    valueGetter: (params) => {
      const unit = params.data.energyDensityUnit
      return unit ? unit.replace('MJ/', '') : 'N/A'
    }
  },
  {
    field: 'fuelType',
    headerName: 'Fuel type',
    width: 220,
    sortable: true
  },
  {
    field: 'fuelCategory',
    headerName: 'Fuel category',
    width: 200,
    sortable: true
  },
  {
    field: 'endUse',
    headerName: 'End use',
    width: 400,
    sortable: true,
    valueFormatter: (params) => params.value || 'N/A'
  },
  {
    field: 'determiningCarbonIntensity',
    headerName: 'Determining carbon intensity',
    width: 400,
    sortable: true
  },
  {
    field: 'targetCi',
    headerName: 'Target CI',
    type: 'numericColumn',
    width: 150,
    sortable: true,
    valueFormatter: (params) =>
      params.value !== null && params.value !== undefined ? params.value.toFixed(2) : 'N/A'
  },
  {
    field: 'ciOfFuel',
    headerName: 'CI of fuel',
    type: 'numericColumn',
    width: 150,
    sortable: true,
    valueFormatter: (params) =>
      params.value !== null && params.value !== undefined ? params.value.toFixed(2) : 'N/A'
  },
  {
    field: 'uci',
    headerName: 'UCI',
    type: 'numericColumn',
    width: 150,
    sortable: true,
    valueFormatter: (params) =>
      params.value !== null && params.value !== undefined ? params.value.toFixed(2) : 'N/A'
  },
  {
    field: 'energyDensity',
    headerName: 'Energy density',
    type: 'numericColumn',
    width: 200,
    sortable: true,
    valueFormatter: (params) =>
      params.data.energyDensity !== null && params.data.energyDensity !== undefined 
        ? params.data.energyDensity.toFixed(2) : 'N/A'
  },
  {
    field: 'eer',
    headerName: 'EER',
    type: 'numericColumn',
    width: 150,
    sortable: true,
    valueFormatter: (params) =>
      params.value !== null && params.value !== undefined ? params.value.toFixed(2) : 'N/A'
  },
  {
    field: 'energy_content',
    headerName: 'Energy content (MJ)',
    type: 'numericColumn',
    width: 250,
    sortable: true,
    valueGetter: (params) => {
      const energyDensity = params.data.energyDensity
      if (!energyDensity) return 'N/A'
      return DEFAULT_QUANTITY * energyDensity
    },
    valueFormatter: (params) =>
      params.value === 'N/A' ? 'N/A' : (params.value ? params.value.toLocaleString() : '0')
  }
]
