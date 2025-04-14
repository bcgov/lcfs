import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { OtherUsesSummary } from '../OtherUsesSummary'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: () => ({
      complianceReportId: '123',
      compliancePeriod: '2024'
    }),
    useLocation: vi.fn()
  }
})

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
    data: {
      roles: [{ name: 'Supplier' }, { name: 'Government' }]
    }
  })
}))

vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  __esModule: true,
  default: () => <div data-test="mockedBCDataGridServer"></div>
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

describe('OtherUsesSummary Component Tests', () => {
  let navigate
  let location

  beforeEach(() => {
    navigate = vi.fn()
    location = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigate)
    vi.mocked(useLocation).mockReturnValue(location)
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it('renders root component', () => {
    render(<OtherUsesSummary />, { wrapper })
    const title = screen.getByTestId('container')
    expect(title).toBeInTheDocument()
  })

  it('displays alert message on initial load if present', () => {
    const mockLocation = {
      state: { message: 'Test Alert Message', severity: 'error' }
    }
    vi.mocked(useLocation).mockReturnValue(mockLocation)

    render(<OtherUsesSummary />, { wrapper })
    const alertBox = screen.getByTestId('alert-box')
    expect(alertBox).toBeInTheDocument()
    expect(alertBox.textContent).toContain('Test Alert Message')
  })
})
