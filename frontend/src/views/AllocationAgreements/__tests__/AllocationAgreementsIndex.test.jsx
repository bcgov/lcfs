import React from 'react'
import { describe, expect, vi, beforeEach } from 'vite-plus/test'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AllocationAgreementsIndex } from '../AllocationAgreementsIndex'
import { allocationAgreementsIndexColDefs } from '../_indexSchema'
import { test } from '@/tests/utils/fixtures'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => mockNavigate
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => fallback ?? key })
}))

let lastGridProps
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => {
    lastGridProps = props
    return (
      <div data-test="grid">
        Page {props.paginationOptions.page} / Size{' '}
        {props.paginationOptions.size}
        <button
          type="button"
          onClick={() =>
            props.onPaginationChange({
              page: 3,
              size: 25,
              sortOrders: [{ field: 'status', direction: 'asc' }],
              filters: [
                {
                  field: 'compliancePeriod',
                  filterType: 'text',
                  type: 'equals',
                  filter: '2024'
                }
              ]
            })
          }
        >
          change-paging
        </button>
        <button
          type="button"
          onClick={() =>
            props.onRowClicked({
              data: { complianceReportId: 42, compliancePeriod: '2024' }
            })
          }
        >
          click-row
        </button>
        <button type="button" onClick={props.onClearFilters}>
          clear-all
        </button>
      </div>
    )
  }
}))

let lastOrgListProps
vi.mock('@/views/Transactions/components/OrganizationList', () => ({
  default: (props) => {
    lastOrgListProps = props
    return (
      <div>
        <span data-test="org-list-label">{props.label}</span>
        <button
          type="button"
          onClick={() =>
            props.onOrgChange({ id: 5, label: 'Org Five', name: 'Org Five' })
          }
        >
          pick-org
        </button>
        <button
          type="button"
          onClick={() =>
            props.onOrgChange({ id: null, label: null, name: null })
          }
        >
          clear-org
        </button>
      </div>
    )
  }
}))

const mockUseIndex = vi.fn()
vi.mock('@/hooks/useAllocationAgreement', () => ({
  useGetAllocationAgreementsIndex: (...args) => mockUseIndex(...args)
}))

describe('AllocationAgreementsIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    lastGridProps = undefined
    mockUseIndex.mockReturnValue({
      data: { allocationAgreements: [], pagination: { total: 0 } },
      isLoading: false
    })
  })

  test('starts on page 1 with 25 rows per page and no organization', ({
    render,
    query,
    theme,
    router
  }) => {
    render(<AllocationAgreementsIndex />, [query, theme, router])

    expect(screen.getByTestId('grid')).toHaveTextContent('Page 1 / Size 25')
    expect(mockUseIndex.mock.calls[0][0]).toMatchObject({
      page: 1,
      size: 25,
      filters: [],
      sortOrders: [],
      organizationId: null
    })
    expect(lastOrgListProps.onlyRegistered).toBe(false)
  })

  test('sends grid sorting, filtering and paging to the server', async ({
    render,
    query,
    theme,
    router
  }) => {
    render(<AllocationAgreementsIndex />, [query, theme, router])

    await userEvent.click(screen.getByText('change-paging'))

    const params = mockUseIndex.mock.calls.at(-1)[0]
    expect(params).toMatchObject({
      page: 3,
      size: 25,
      sortOrders: [{ field: 'status', direction: 'asc' }],
      filters: [{ field: 'compliancePeriod', filter: '2024' }]
    })
  })

  test('selecting an organization filters, returns to page 1 and keeps grid filters', async ({
    render,
    query,
    theme,
    router
  }) => {
    render(<AllocationAgreementsIndex />, [query, theme, router])
    await userEvent.click(screen.getByText('change-paging'))

    await userEvent.click(screen.getByText('pick-org'))

    const params = mockUseIndex.mock.calls.at(-1)[0]
    expect(params.organizationId).toBe(5)
    expect(params.page).toBe(1)
    expect(params.filters).toHaveLength(1)
    expect(lastGridProps.filterToolbarConfig.additionalPills).toEqual([
      expect.objectContaining({ value: 'Org Five', type: 'select' })
    ])
  })

  test('clearing the organization removes the filter but keeps other filters', async ({
    render,
    query,
    theme,
    router
  }) => {
    render(<AllocationAgreementsIndex />, [query, theme, router])
    await userEvent.click(screen.getByText('change-paging'))
    await userEvent.click(screen.getByText('pick-org'))

    await userEvent.click(screen.getByText('clear-org'))

    const params = mockUseIndex.mock.calls.at(-1)[0]
    expect(params.organizationId).toBeNull()
    expect(params.filters).toHaveLength(1)
    expect(lastGridProps.filterToolbarConfig.additionalPills).toEqual([])
  })

  test('removing the organization pill clears the filter', async ({
    render,
    query,
    theme,
    router
  }) => {
    render(<AllocationAgreementsIndex />, [query, theme, router])
    await userEvent.click(screen.getByText('pick-org'))

    lastGridProps.filterToolbarConfig.additionalPills[0].onRemove()
    await screen.findByTestId('grid')

    expect(mockUseIndex.mock.calls.at(-1)[0].organizationId).toBeNull()
  })

  test('clear all resets the grid and the organization', async ({
    render,
    query,
    theme,
    router
  }) => {
    render(<AllocationAgreementsIndex />, [query, theme, router])
    await userEvent.click(screen.getByText('pick-org'))
    await userEvent.click(screen.getByText('change-paging'))

    await userEvent.click(screen.getByText('clear-all'))

    expect(mockUseIndex.mock.calls.at(-1)[0]).toMatchObject({
      page: 1,
      size: 25,
      filters: [],
      sortOrders: [],
      organizationId: null
    })
  })

  test('restores the organization selected earlier in the session', ({
    render,
    query,
    theme,
    router
  }) => {
    sessionStorage.setItem(
      'allocation-agreements-index-orgFilter',
      JSON.stringify({ id: 9, label: 'Saved Org', name: 'Saved Org' })
    )

    render(<AllocationAgreementsIndex />, [query, theme, router])

    expect(mockUseIndex.mock.calls[0][0].organizationId).toBe(9)
  })

  test('clicking a row opens the compliance report', async ({
    render,
    query,
    theme,
    router
  }) => {
    render(<AllocationAgreementsIndex />, [query, theme, router])

    await userEvent.click(screen.getByText('click-row'))

    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/2024/42')
  })
})

describe('allocationAgreementsIndexColDefs', () => {
  const fields = allocationAgreementsIndexColDefs().map((col) => col.field)

  test('leads with the compliance report columns', () => {
    expect(fields.slice(0, 3)).toEqual([
      'status',
      'compliancePeriod',
      'reportingOrganization'
    ])
  })

  test('includes every column of the allocation agreement grid', () => {
    expect(fields).toEqual(
      expect.arrayContaining([
        'allocationTransactionType',
        'transactionPartner',
        'postalAddress',
        'transactionPartnerEmail',
        'transactionPartnerPhone',
        'fuelType',
        'fuelTypeOther',
        'fuelCategory',
        'provisionOfTheAct',
        'fuelCode',
        'ciOfFuel',
        'quantity',
        'q1Quantity',
        'q2Quantity',
        'q3Quantity',
        'q4Quantity',
        'totalQuantity',
        'units'
      ])
    )
  })

  test('every column can be sorted and filtered', () => {
    for (const col of allocationAgreementsIndexColDefs()) {
      expect(col.sortable, col.field).toBe(true)
      expect(col.filter, col.field).toBeTruthy()
    }
  })
})
