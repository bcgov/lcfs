import 'react'
import { beforeEach, describe, expect, vi } from 'vite-plus/test'
import { screen } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { InitiativeAgreements } from '../InitiativeAgreements'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

let mockRoles = [roles.ia_analyst]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockRoles.map((name) => ({ name })) },
    hasRoles: (...names) => names.some((n) => mockRoles.includes(n)),
    hasAnyRole: (...names) => names.some((n) => mockRoles.includes(n))
  })
}))

const mockUseGetInitiativeAgreements = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useGetInitiativeAgreements: (...args) =>
    mockUseGetInitiativeAgreements(...args),
  // Consumed by the status column's select filter.
  useInitiativeAgreementStatuses: () => ({ data: [], isLoading: false }),
  // Consumed by the create-agreement control in the page header.
  useCreateAgreement: () => ({ mutate: vi.fn(), isPending: false })
}))

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizationNames: () => ({ data: [], isLoading: false })
}))

// Role reaches for the authorization context, which this page-level test
// has no reason to stand up.
vi.mock('@/components/Role', () => ({
  Role: ({ children }) => <>{children}</>
}))

const mockBCGridViewer = vi.fn()
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => {
    mockBCGridViewer(props)
    return (
      <div
        data-test="bc-grid-container"
        data-grid-key={props.gridKey}
        data-data-key={props.dataKey}
      />
    )
  }
}))

describe('InitiativeAgreements', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    mockBCGridViewer.mockClear()
    mockUseGetInitiativeAgreements.mockReset()
    mockRoles = [roles.ia_analyst]
  })

  test('gives a proponent the same grid without the organization column (#4893)', ({
    render,
    app
  }) => {
    mockRoles = [roles.ia_proponent]
    mockUseGetInitiativeAgreements.mockReturnValue({
      data: { initiativeAgreements: [], pagination: { total: 0 } },
      isLoading: false,
      isError: false
    })
    render(<InitiativeAgreements />, app)
    mockRoles = [roles.ia_analyst]

    const { columnDefs } = mockBCGridViewer.mock.calls[0][0]
    const fields = columnDefs.map((colDef) => colDef.field)
    // One organization, so the column would repeat itself on every row.
    expect(fields).not.toContain('organization.name')
    // Status filter, sort and the rest are the shared grid.
    expect(fields).toContain('lifecycleStatus.status')
    expect(fields).toContain('lastComment')
  })

  test('renders the index grid wired to the agreements list query', ({
    render,
    app
  }) => {
    mockUseGetInitiativeAgreements.mockReturnValue({
      data: {
        initiativeAgreements: [],
        pagination: { total: 0, page: 1, size: 10, totalPages: 0 }
      },
      isLoading: false,
      isError: false,
      error: null
    })

    render(<InitiativeAgreements />, app)

    expect(
      screen.getByTestId('initiative-agreements-title')
    ).toBeInTheDocument()

    const grid = screen.getByTestId('bc-grid-container')
    expect(grid).toHaveAttribute('data-grid-key', 'initiative-agreements-grid')
    expect(grid).toHaveAttribute('data-data-key', 'initiativeAgreements')

    expect(mockUseGetInitiativeAgreements).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        size: 10,
        sortOrders: [{ field: 'updateDate', direction: 'desc' }]
      })
    )
    const gridProps = mockBCGridViewer.mock.calls[0][0]
    expect(gridProps.persistForLoginSession).toBe(true)
    expect(gridProps.columnDefs.map((colDef) => colDef.field)).toContain(
      'iaCode'
    )
  })

  test('surfaces query errors in the alert box', ({ render, app }) => {
    mockUseGetInitiativeAgreements.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'boom' }
    })

    render(<InitiativeAgreements />, app)

    expect(screen.getByTestId('alert-box')).toHaveTextContent('boom')
  })

  test('passes onClearFilters to BCGridViewer and removes cached keys when called', ({
    render,
    app
  }) => {
    mockUseGetInitiativeAgreements.mockReturnValue({
      data: {
        initiativeAgreements: [],
        pagination: { total: 0, page: 1, size: 10, totalPages: 0 }
      },
      isLoading: false,
      isError: false,
      error: null
    })

    localStorage.setItem(
      'initiative-agreements-grid-filter',
      '{"status":"Draft"}'
    )
    localStorage.setItem(
      'initiative-agreements-grid-pagination',
      '{"page":3,"size":25}'
    )

    render(<InitiativeAgreements />, app)

    const gridProps = mockBCGridViewer.mock.calls.at(-1)[0]
    expect(typeof gridProps.onClearFilters).toBe('function')

    gridProps.onClearFilters()
    expect(localStorage.getItem('initiative-agreements-grid-filter')).toBeNull()
    expect(
      localStorage.getItem('initiative-agreements-grid-pagination')
    ).toBeNull()
  })

  test('hydrates pagination from localStorage so prefs survive closing the window (#5032)', ({
    render,
    app
  }) => {
    mockUseGetInitiativeAgreements.mockReturnValue({
      data: {
        initiativeAgreements: [],
        pagination: { total: 0, page: 2, size: 25, totalPages: 1 }
      },
      isLoading: false,
      isError: false,
      error: null
    })

    localStorage.setItem(
      'initiative-agreements-grid-pagination',
      JSON.stringify({
        page: 2,
        size: 25,
        sortOrders: [{ field: 'iaCode', direction: 'asc' }],
        filters: []
      })
    )

    render(<InitiativeAgreements />, app)

    expect(mockUseGetInitiativeAgreements).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        size: 25,
        sortOrders: [{ field: 'iaCode', direction: 'asc' }]
      })
    )
    expect(mockBCGridViewer.mock.calls.at(-1)[0].paginationOptions).toEqual(
      expect.objectContaining({
        page: 2,
        size: 25,
        sortOrders: [{ field: 'iaCode', direction: 'asc' }]
      })
    )
  })
})
