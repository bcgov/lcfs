import { SUMMARY } from '@/constants/common'
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
    valueGetter: (params) => params.data.fuelType
  },
  {
    headerName: t('legacy:columnLabels.fuelClass'),
    field: 'fuelCategory',
    valueGetter: (params) => params.data.fuelCategory
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.determiningCarbonIntensity'),
    field: 'determiningCarbonIntensity',
    valueGetter: (params) => params.data.provisionOfTheAct
  },
  {
    headerName: t('fuelSupply:fuelSupplyColLabels.fuelCode'),
    field: 'fuelCode',
    valueGetter: (params) => params.data.fuelCode
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

export const exclusionSummaryColDefs = (t) => [
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.allocationTransactionType'
    ),
    field: 'allocationTransactionType'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartner'
    ),
    field: 'transactionPartner'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.postalAddress'
    ),
    field: 'postalAddress'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartnerEmail'
    ),
    field: 'transactionPartnerEmail'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.transactionPartnerPhone'
    ),
    field: 'transactionPartnerPhone'
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.fuelType'),
    field: 'fuelType'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.fuelCategory'
    ),
    field: 'fuelCategory'
  },
  {
    headerName: t(
      'allocationAgreement:allocationAgreementColLabels.carbonIntensity'
    ),
    field: 'provisionOfTheAct'
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.fuelCode'),
    field: 'fuelCode'
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.ciOfFuel'),
    field: 'ciOfFuel'
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.quantity'),
    field: 'quantity',
    valueFormatter
  },
  {
    headerName: t('allocationAgreement:allocationAgreementColLabels.units'),
    field: 'units'
  }
]

export const renewableFuelColumns = (t, data) => {
  return [
    {
      id: 'line',
      label: t('report:summaryLabels.line'),
      align: 'center',
      width: '100px',
      bold: true
    },
    {
      id: 'description',
      label: t('report:part2RenewableFuelTargetSummary'),
      maxWidth: '300px'
    },
    {
      id: 'gasoline',
      label: t('report:fuelLabels.gasoline'),
      align: 'right',
      width: '150px',
      cellConstraints: {
        5: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].gasoline) },
        7: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].gasoline) }
      }
    },
    {
      id: 'diesel',
      label: t('report:fuelLabels.diesel'),
      align: 'right',
      width: '150px',
      cellConstraints: {
        5: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].diesel) },
        7: { min: 0, max: Math.round(0.05 * data[SUMMARY.LINE_4].diesel) }
      }
    }
  ]
}

export const lowCarbonColumns = (t) => [
  {
    id: 'line',
    label: t('report:summaryLabels.line'),
    align: 'center',
    width: '100px',
    bold: true
  },
  {
    id: 'description',
    label: t('report:part3LowCarbonFuelTargetSummary'),
    maxWidth: '300px'
  },
  {
    id: 'value',
    label: t('report:summaryLabels.value'),
    align: 'center',
    width: '150px'
  },
  {
    id: 'units',
    label: t('report:summaryLabels.units'),
    align: 'center',
    width: '150px'
  }
]

export const nonComplianceColumns = (t) => [
  {
    id: 'description',
    label: t('report:nonCompliancePenaltySummary'),
    maxWidth: '300px'
  },
  {
    id: 'totalValue',
    label: t('report:summaryLabels.totalValue'),
    align: 'center',
    width: '150px'
  }
]
