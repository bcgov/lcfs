import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { InitiativeAgreements } from '../InitiativeAgreements'

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

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: [{ name: 'IA Analyst' }] },
    hasRoles: (...names) => names.includes(roles.ia_analyst),
    hasAnyRole: (...names) => names.includes(roles.ia_analyst)
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
  it('renders the index grid wired to the agreements list query', () => {
    mockUseGetInitiativeAgreements.mockReturnValue({
      data: {
        initiativeAgreements: [],
        pagination: { total: 0, page: 1, size: 10, totalPages: 0 }
      },
      isLoading: false,
      isError: false,
      error: null
    })

    render(<InitiativeAgreements />, { wrapper })

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
    expect(gridProps.columnDefs.map((colDef) => colDef.field)).toContain(
      'iaCode'
    )
  })

  it('surfaces query errors in the alert box', () => {
    mockUseGetInitiativeAgreements.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'boom' }
    })

    render(<InitiativeAgreements />, { wrapper })

    expect(screen.getByTestId('alert-box')).toHaveTextContent('boom')
  })
})
