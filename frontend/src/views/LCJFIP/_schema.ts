import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import {
  BCDateFloatingFilter,
  BCSelectFloatingFilter
} from '@/components/BCDataGrid/components'
import {
  useLCJFIPStatuses,
  type LCJFIPApplicationListItem
} from '@/hooks/useLCJFIP'
import { LCJFIPApplicationStatusRenderer } from '@/utils/grid/cellRenderers'

// Column definitions for the LCJFIP applications index (#5541). Rows are
// filtered, sorted and paged on the server; the field names are the list
// endpoint's camelCase row fields.

type Row = LCJFIPApplicationListItem
type RowFormatterParams = ValueFormatterParams<Row>

const TEXT_FILTER_PARAMS = {
  filterOptions: ['contains', 'startsWith', 'equals'],
  buttons: ['clear']
}

const DATE_FILTER_PARAMS = {
  filterOptions: ['inRange', 'equals', 'lessThan', 'greaterThan'],
  defaultOption: 'inRange',
  buttons: ['clear']
}

/**
 * A date in the portal's YYYY-MM-DD format, on the Pacific calendar: the
 * server filters submission dates the same way, so a late-afternoon
 * submission does not show the next day's (UTC) date.
 */
export const formatPacificDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString('en-CA', {
        timeZone: 'America/Vancouver'
      })
    : ''

/**
 * The authorized disbursement in the unit of the preferred option: dollars
 * for the cash incentive, credits for the credit options. Empty until a
 * disbursement is authorized.
 */
export const formatDisbursement = (
  amount: number | null | undefined,
  incentiveType: Row['incentiveType'] | undefined,
  creditsLabel: (amount: string) => string
) => {
  if (amount === null || amount === undefined) return ''
  if (incentiveType === 'Credit') {
    return creditsLabel(amount.toLocaleString('en-CA'))
  }
  return amount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })
}

/** An empty cell shows a dash, as in the mock-up and elsewhere in the portal. */
export const EMPTY_CELL = '—'

// The mock-up centres the dates and the disbursement in their cells.
const CENTRED: Pick<ColDef, 'cellStyle'> = {
  cellStyle: { textAlign: 'center' }
}

// When the columns fit, the grid shares the width by flex (each column's
// minWidth then only applies once the grid scrolls). The portal theme
// truncates header text rather than wrapping it, so the weights give the
// longer headers room at desktop widths, and their tooltip names them in full.
//
// A supplier's weights are the mock-up's column widths in hundreds of pixels
// (215, 160, 208, 232, 250 and 304 px at 1440 px wide). The mock-up has no
// government view; with Organization added, those weights would cut off the
// Application ID header, so government users get weights that leave every
// header room.
const SUPPLIER_FLEX = {
  status: 2.15,
  applicationNumber: 1.6,
  contactName: 2.08,
  submittedDate: 2.32,
  incentiveAwardDate: 2.5,
  authorizedDisbursement: 3.04
}
const GOVERNMENT_FLEX = {
  status: 1.5,
  applicationNumber: 1.5,
  organizationName: 1.9,
  contactName: 1.6,
  submittedDate: 1.75,
  incentiveAwardDate: 2,
  authorizedDisbursement: 2.35
}

const longHeader = (headerName: string) => ({
  headerName,
  headerTooltip: headerName
})

const textColumn = (
  field: keyof Row,
  headerName: string,
  minWidth: number,
  flex = 1
): ColDef => ({
  field,
  headerName,
  minWidth,
  flex,
  filter: 'agTextColumnFilter',
  filterParams: TEXT_FILTER_PARAMS
})

/**
 * The index columns, in the order the story lists them. Organization is
 * for government users only: a BCeID user's rows all belong to their own
 * organization. The award date and disbursement have no data until the
 * award and disbursement stories, so they neither filter nor sort yet.
 */
export const lcjfipApplicationColDefs = (
  t: TFunction,
  { isGovernment }: { isGovernment: boolean }
): ColDef[] => {
  const flex: typeof SUPPLIER_FLEX = isGovernment
    ? GOVERNMENT_FLEX
    : SUPPLIER_FLEX
  const columns: (ColDef | false)[] = [
    {
      field: 'status',
      headerName: t('lcjfip:index.columns.status'),
      cellRenderer: LCJFIPApplicationStatusRenderer,
      minWidth: 130,
      flex: flex.status,
      floatingFilterComponent: BCSelectFloatingFilter,
      floatingFilterComponentParams: {
        valueKey: 'status',
        labelKey: 'status',
        optionsQuery: useLCJFIPStatuses
      },
      suppressFloatingFilterButton: true
    },
    textColumn(
      'applicationNumber',
      t('lcjfip:index.columns.applicationNumber'),
      140,
      flex.applicationNumber
    ),
    isGovernment &&
      textColumn(
        'organizationName',
        t('lcjfip:index.columns.organization'),
        180,
        GOVERNMENT_FLEX.organizationName
      ),
    textColumn(
      'contactName',
      t('lcjfip:index.columns.contact'),
      150,
      flex.contactName
    ),
    {
      field: 'submittedDate',
      headerName: t('lcjfip:index.columns.submittedDate'),
      valueFormatter: (params: RowFormatterParams) =>
        formatPacificDate(params.value) || EMPTY_CELL,
      ...CENTRED,
      filter: 'agDateColumnFilter',
      filterParams: DATE_FILTER_PARAMS,
      floatingFilterComponent: BCDateFloatingFilter,
      floatingFilterComponentParams: { initialFilterType: 'equals' },
      suppressFloatingFilterButton: true,
      minWidth: 150,
      flex: flex.submittedDate
    },
    {
      field: 'incentiveAwardDate',
      ...longHeader(t('lcjfip:index.columns.incentiveAwardDate')),
      valueFormatter: (params: RowFormatterParams) =>
        params.value || EMPTY_CELL,
      ...CENTRED,
      filter: false,
      sortable: false,
      minWidth: 190,
      flex: flex.incentiveAwardDate
    },
    {
      field: 'authorizedDisbursement',
      ...longHeader(t('lcjfip:index.columns.authorizedDisbursement')),
      valueFormatter: (params: RowFormatterParams) =>
        formatDisbursement(params.value, params.data?.incentiveType, (amount) =>
          t('lcjfip:incentive.credits', { amount })
        ) || EMPTY_CELL,
      ...CENTRED,
      filter: false,
      sortable: false,
      minWidth: 220,
      flex: flex.authorizedDisbursement
    }
  ]
  return columns.filter((column): column is ColDef => !!column)
}

// No sort column is shown by default; the server lists the most recently
// changed applications first.
export const defaultSortModel: {
  field: string
  direction: 'asc' | 'desc'
}[] = []
