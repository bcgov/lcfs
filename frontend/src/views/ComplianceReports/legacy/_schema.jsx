import { formatNumberWithCommas as valueFormatter } from '@/utils/formatters.js'

export const scheduleASummaryColDefs = (t) => [
  {
    headerName: t('notionalTransfer:notionalTransferColLabels.legalName'),
    field: 'legalName',
    flex: 1,
    minWidth: 200
  },
  {
    headerName: t(
      'notionalTransfer:notionalTransferColLabels.addressForService'
    ),
    field: 'addressForService',
    flex: 1,
    minWidth: 200
  },
  {
    headerName: t('legacy:columnLabels.fuelClass'),
    field: 'fuelCategory'
  },
  {
    headerName: t(
      'notionalTransfer:notionalTransferColLabels.receivedOrTransferred'
    ),
    field: 'receivedOrTransferred'
  },
  {
    headerName: t('notionalTransfer:notionalTransferColLabels.quantity'),
    field: 'quantity',
    valueFormatter
  }
]

export const scheduleBSummaryColDefs = (t) => [
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.complianceUnits'),
    field: 'complianceUnits',
    valueFormatter
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.fuelType'),
    field: 'fuelType',
    valueGetter: (params) => params.data.fuelType?.fuelType
  },
  {
    headerName: t('legacy:columnLabels.fuelClass'),
    field: 'fuelCategory',
    valueGetter: (params) => params.data.fuelCategory?.category
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.determiningCarbonIntensity'),
    field: 'determiningCarbonIntensity',
    valueGetter: (params) => params.data.provisionOfTheAct?.name
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.fuelCode'),
    field: 'fuelCode',
    valueGetter: (params) => params.data.fuelCode?.fuelCode
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.quantity'),
    field: 'quantity',
    valueFormatter
  },
  { headerName: t('fuelSupply:fuelSupplyColLabels.units'), field: 'units' },
  {
    headerName: t('legacy:columnLabels.ciLimit'),
    field: 'targetCi'
  },
  {
    headerName: t('legacy:columnLabels.fuelCi'),
    field: 'ciOfFuel'
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.energyDensity'),
    field: 'energyDensity'
  },
  { headerName: t('fuelSupply:fuelSupplyColLabels.eer'), field: 'eer' },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.energy'),
    field: 'energy',
    valueFormatter
  }
]

export const scheduleCSummaryColDefs = (t) => [
  {
    headerName: t('otherUses:otherUsesColLabels.fuelType'),
    field: 'fuelType',
    floatingFilter: false,
    width: '260px'
  },
  {
    headerName: t('legacy:columnLabels.fuelClass'),
    field: 'fuelCategory',
    floatingFilter: false
  },
  {
    headerName: t('otherUses:otherUsesColLabels.quantitySupplied'),
    field: 'quantitySupplied',
    floatingFilter: false,
    valueFormatter
  },
  {
    headerName: t('otherUses:otherUsesColLabels.units'),
    field: 'units',
    floatingFilter: false
  },
  {
    headerName: t('otherUses:otherUsesColLabels.expectedUse'),
    field: 'expectedUse',
    floatingFilter: false,
    flex: 1,
    minWidth: 200
  },
  {
    headerName: t('otherUses:otherUsesColLabels.otherExpectedUse'),
    field: 'rationale',
    floatingFilter: false,
    flex: 1,
    minWidth: 200
  }
]
