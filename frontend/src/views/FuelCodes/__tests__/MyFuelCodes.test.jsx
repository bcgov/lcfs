import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'fuelCode:myFuelCodesTitle': "My organization's fuel codes",
        'fuelCode:noFuelCodesFound': 'No fuel codes found',
        'fuelCode:fuelCodeLoadFailMsg': 'Failed to load fuel code information.'
      }
      return translations[key] || key
    }
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

let mockUserRoles = [{ name: roles.ci_applicant }]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockUserRoles }
  })
}))

const mockBCGridViewer = vi.fn()
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => {
    mockBCGridViewer(props)
    const { dataKey, gridKey } = props
    return (
      <div
        data-test="bc-grid-container"
        data-grid-key={gridKey}
        data-data-key={dataKey}
      >
        <button
          type="button"
          data-test="trigger-pagination"
          onClick={() =>
            props.onPaginationChange?.({ page: 3, size: 25 })
          }
        >
          Change pagination
        </button>
      </div>
    )
  }
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

vi.mock('@/views/CarbonIntensity/components/FuelCodesTabs', () => ({
  FuelCodesTabs: () => <div data-test="fuel-codes-tabs" />
}))

const mockNavigate = vi.fn()
const mockLocationState = { state: null }
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocationState,
    Navigate: ({ to }) => <div data-test="redirect" data-to={to} />
  }
})

const mockUseGetMyFuelCodes = vi.fn()
vi.mock('@/hooks/useFuelCode', () => ({
  useGetMyFuelCodes: (...args) => mockUseGetMyFuelCodes(...args),
  useFuelCodeStatuses: vi.fn(() => ({ data: [] })),
  useTransportModes: vi.fn(() => ({ data: [] }))
}))

import { MyFuelCodes } from '@/views/FuelCodes/MyFuelCodes.jsx'

describe('MyFuelCodes', () => {
  beforeEach(() => {
    mockUserRoles = [{ name: roles.ci_applicant }]
    mockLocationState.state = null
    mockBCGridViewer.mockClear()
    mockUseGetMyFuelCodes.mockReset()
    mockUseGetMyFuelCodes.mockReturnValue({
      data: {
        pagination: { total: 0, page: 1, size: 10 },
        fuelCodes: []
      },
      isLoading: false,
      isError: false,
      error: null
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders the organization-scoped title and grid for a CI Applicant', () => {
    render(<MyFuelCodes />, { wrapper })

    expect(screen.getByTestId('title')).toHaveTextContent(
      "My organization's fuel codes"
    )
    const grid = screen.getByTestId('bc-grid-container')
    expect(grid).toHaveAttribute('data-grid-key', 'my-fuel-codes-grid')
    expect(grid).toHaveAttribute('data-data-key', 'fuelCodes')
  })

  it('queries the my-fuel-codes hook (not the IDIR list hook)', () => {
    render(<MyFuelCodes />, { wrapper })

    expect(mockUseGetMyFuelCodes).toHaveBeenCalled()
    const [pagination] = mockUseGetMyFuelCodes.mock.calls[0]
    expect(pagination).toEqual(
      expect.objectContaining({
        page: 1,
        size: 10,
        filters: []
      })
    )
  })

  it('redirects users without the CI Applicant role away from the page', () => {
    mockUserRoles = [{ name: roles.read_only }]

    render(<MyFuelCodes />, { wrapper })

    expect(screen.getByTestId('redirect')).toBeInTheDocument()
    expect(screen.queryByTestId('title')).not.toBeInTheDocument()
  })

  it('surfaces an alert message passed via location state', () => {
    mockLocationState.state = {
      message: 'Saved successfully',
      severity: 'success'
    }

    render(<MyFuelCodes />, { wrapper })

    const alertBox = screen.getByTestId('alert-box')
    expect(alertBox).toHaveTextContent('Saved successfully')
  })

  it('does not turn rows into navigation links (no detail page yet)', () => {
    render(<MyFuelCodes />, { wrapper })

    const gridProps = mockBCGridViewer.mock.calls.at(-1)[0]
    expect(gridProps.defaultColDef).toBeUndefined()
  })

  it('forwards the grid pagination changes back into the query hook', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<MyFuelCodes />, { wrapper })

    await user.click(screen.getByTestId('trigger-pagination'))

    const lastCall =
      mockUseGetMyFuelCodes.mock.calls[
        mockUseGetMyFuelCodes.mock.calls.length - 1
      ]
    expect(lastCall[0]).toEqual(
      expect.objectContaining({ page: 3, size: 25 })
    )
  })

  it('shows a localized error message when the data load fails', () => {
    mockUseGetMyFuelCodes.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: '' }
    })

    render(<MyFuelCodes />, { wrapper })

    const alertBox = screen.getByTestId('alert-box')
    expect(alertBox).toHaveTextContent('Failed to load fuel code information.')
  })

  it('preserves the backend error message when the API surfaces one', () => {
    mockUseGetMyFuelCodes.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'Server unreachable' }
    })

    render(<MyFuelCodes />, { wrapper })

    expect(screen.getByTestId('alert-box')).toHaveTextContent(
      'Server unreachable'
    )
  })
})
