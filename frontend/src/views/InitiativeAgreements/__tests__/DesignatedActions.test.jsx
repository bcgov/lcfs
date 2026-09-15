import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import {
  DesignatedActions,
  defaultActionsSortModel
} from '../DesignatedActions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { token: 'mock-token', authenticated: true, initialized: true }
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

const mockUseAllDesignatedActions = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useAllDesignatedActions: (...args) => mockUseAllDesignatedActions(...args),
  // Consumed by the status column's floating filter.
  useInitiativeAgreementAnalysts: () => ({ data: [], isLoading: false }),
  useInitiativeAgreementStatuses: () => ({ data: [], isLoading: false })
}))

vi.mock('../components/InitiativeAgreementTabs', () => ({
  default: () => <div data-test="initiative-agreement-tabs" />
}))

const mockBCGridViewer = vi.fn()
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => {
    mockBCGridViewer(props)
    return <div data-test="bc-grid-viewer" />
  }
}))

describe('DesignatedActions (module tab)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoles = [roles.ia_analyst]
    mockUseAllDesignatedActions.mockReturnValue({
      data: { designatedActions: [], pagination: { total: 0 } },
      isLoading: false,
      isError: false
    })
  })

  it('renders the tab bar, title and grid wired to the module-wide query', () => {
    render(<DesignatedActions />, { wrapper })

    expect(screen.getByTestId('initiative-agreement-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('designated-actions-title')).toHaveTextContent(
      'initiativeAgreement:actions.tabTitle'
    )
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
    expect(mockBCGridViewer).toHaveBeenCalledWith(
      expect.objectContaining({
        gridKey: 'all-designated-actions-grid',
        dataKey: 'designatedActions'
      })
    )
  })

  it('asks for newest activity first by default', () => {
    render(<DesignatedActions />, { wrapper })

    expect(defaultActionsSortModel).toEqual([
      { field: 'updateDate', direction: 'desc' }
    ])
    expect(mockUseAllDesignatedActions).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrders: defaultActionsSortModel })
    )
  })

  it('links each row to the action under its own agreement', () => {
    render(<DesignatedActions />, { wrapper })

    const { defaultColDef } = mockBCGridViewer.mock.calls[0][0]
    expect(
      defaultColDef.cellRendererParams.url({
        data: { initiativeAgreementId: 5, designatedActionId: 12 }
      })
    ).toBe('/initiative-agreements/5/designated-actions/12')
  })

  it('surfaces a load failure in the alert box', () => {
    mockUseAllDesignatedActions.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Boom')
    })
    render(<DesignatedActions />, { wrapper })

    expect(screen.getByTestId('alert-box')).toHaveTextContent('Boom')
  })

  it('is not offered to a proponent', () => {
    mockRoles = [roles.ia_proponent]
    render(<DesignatedActions />, { wrapper })

    expect(screen.queryByTestId('designated-actions-title')).toBeNull()
  })
})
