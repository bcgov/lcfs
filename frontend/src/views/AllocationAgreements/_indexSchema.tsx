import { useMemo } from 'react'
import type { ColDef } from 'ag-grid-community'
import { BCSelectFloatingFilter } from '@/components/BCDataGrid/components/Filters/BCSelectFloatingFilter'
import i18n from '@/i18n'
import { useGetComplianceReportStatuses } from '@/hooks/useComplianceReports'
import { formatNumberWithCommas as numberFormatter } from '@/utils/formatters'

const label = (key: string) =>
  i18n.t(`allocationAgreement:allocationAgreementColLabels.${key}`)

// Draft report versions never appear in this index, so Draft is not offered
// as a status to filter by.
const useIndexReportStatuses = () => {
  const query = useGetComplianceReportStatuses()
  const data = useMemo(
    () =>
      (query.data as Array<{ status: string }> | undefined)?.filter(
        (item) => item.status !== 'Draft'
      ),
    [query.data]
  )
  return { ...query, data }
}

const textColumn = (
  field: string,
  headerName: string,
  minWidth: number
): ColDef => ({
  field,
  headerName,
  minWidth,
  filter: 'agTextColumnFilter',
  filterParams: {
    // The API ignores spaces and case when filtering text
    textFormatter: (value: string | null) =>
      value == null ? '' : value.replace(/\s+/g, '').toLowerCase()
  },
  sortable: true
})

const numberFilterParams = {
  // The API supports single-value comparisons (no range / AND-OR groups)
  filterOptions: [
    'equals',
    'notEqual',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual'
  ],
  maxNumConditions: 1,
  buttons: ['clear']
}

const quantityFormatter = (params: { value?: number | null }) =>
  params.value == null
    ? ''
    : (numberFormatter({ value: params.value }) as string)

const numberColumn = (
  field: string,
  headerName: string,
  minWidth: number,
  valueFormatter?: ColDef['valueFormatter']
): ColDef => ({
  field,
  headerName,
  minWidth,
  type: 'numericColumn',
  filter: 'agNumberColumnFilter',
  filterParams: numberFilterParams,
  sortable: true,
  valueFormatter
})

/**
 * Columns for the IDIR allocation agreements index: the compliance report
 * version's Status / Compliance period / Reporting organization followed by
 * every column of the allocation agreement grid. Early issuance's quarterly
 * quantities are all included since a row can belong to either report type.
 */
export const allocationAgreementsIndexColDefs = (): ColDef[] => [
  {
    field: 'status',
    headerName: label('status'),
    minWidth: 190,
    filter: true,
    sortable: true,
    filterParams: { buttons: ['clear'] },
    floatingFilterComponent: BCSelectFloatingFilter,
    floatingFilterComponentParams: {
      optionsQuery: useIndexReportStatuses,
      valueKey: 'status',
      labelKey: 'status'
    },
    suppressFloatingFilterButton: true,
    // The API returns the display value ("Analyst adjustment")
    valueFormatter: (params) => String(params.value ?? '').replace(/_/g, ' ')
  },
  textColumn('compliancePeriod', label('compliancePeriod'), 200),
  textColumn('reportingOrganization', label('reportingOrganization'), 260),
  textColumn(
    'allocationTransactionType',
    label('allocationTransactionType'),
    175
  ),
  textColumn('transactionPartner', label('transactionPartner'), 310),
  textColumn('postalAddress', label('postalAddress'), 350),
  textColumn('transactionPartnerEmail', label('transactionPartnerEmail'), 200),
  textColumn('transactionPartnerPhone', label('transactionPartnerPhone'), 200),
  textColumn('fuelType', label('fuelType'), 200),
  textColumn('fuelTypeOther', label('fuelTypeOther'), 250),
  textColumn('fuelCategory', label('fuelCategory'), 150),
  textColumn('provisionOfTheAct', label('provisionOfTheAct'), 300),
  textColumn('fuelCode', label('fuelCode'), 175),
  numberColumn('ciOfFuel', label('ciOfFuel'), 100, (params) =>
    params.value != null ? parseFloat(params.value).toFixed(2) : ''
  ),
  numberColumn('quantity', label('quantity'), 130, quantityFormatter),
  numberColumn('q1Quantity', label('q1Quantity'), 150, quantityFormatter),
  numberColumn('q2Quantity', label('q2Quantity'), 150, quantityFormatter),
  numberColumn('q3Quantity', label('q3Quantity'), 150, quantityFormatter),
  numberColumn('q4Quantity', label('q4Quantity'), 150, quantityFormatter),
  numberColumn('totalQuantity', label('totalQuantity'), 150, quantityFormatter),
  textColumn('units', label('units'), 130)
]

export const allocationAgreementsIndexDefaultColDef: ColDef = {
  editable: false,
  resizable: true,
  filter: false,
  floatingFilter: true,
  suppressFloatingFilterButton: true,
  sortable: false
}
