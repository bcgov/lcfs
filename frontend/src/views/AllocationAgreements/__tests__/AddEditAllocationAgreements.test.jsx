// src/views/AllocationAgreements/__tests__/AddEditAllocationAgreements.test.jsx

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AddEditAllocationAgreements } from '../AddEditAllocationAgreements'
import * as useAllocationAgreementHook from '@/hooks/useAllocationAgreement'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'

// Mock react-router-dom hooks
const mockUseLocation = vi.fn()
const mockUseNavigate = vi.fn()
const mockUseParams = vi.fn()

vi.mock('@/hooks/useCurrentUser')

vi.mock('@/hooks/useComplianceReports')

vi.mock('@react-keycloak/web', () => ({
  ReactKeycloakProvider: ({ children }) => children,
  useKeycloak: () => ({
    keycloak: {
      authenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn()
    },
    initialized: true
  })
}))

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate(),
  useParams: () => mockUseParams(),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()]
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: vi.fn((key, options = {}) => {
      // Handle specific keys with returnObjects
      if (
        key === 'allocationAgreement:allocationAgreementGuides' &&
        options.returnObjects
      ) {
        return ['Guide 1', 'Guide 2', 'Guide 3'] // Mocked guide objects
      }
      return key
    })
  })
}))

// Mock hooks related to allocation agreements
vi.mock('@/hooks/useAllocationAgreement')

// Mock BCGridEditor component
vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: ({
    gridRef,
    alertRef,
    onGridReady,
    rowData,
    onCellValueChanged,
    onCellEditingStopped
  }) => (
    <div data-test="bc-grid-editor">
      <div data-test="row-data">
        {rowData.map((row, index) => (
          <div key={index} data-test="grid-row">
            {row.id}
          </div>
        ))}
      </div>
    </div>
  )
}))

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

describe('AddEditAllocationAgreements', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    // Mock react-router-dom hooks with complete location object
    mockUseLocation.mockReturnValue({
      pathname: '/test-path', // Include pathname to prevent undefined errors
      state: {}
    })
    mockUseNavigate.mockReturnValue(vi.fn())
    mockUseParams.mockReturnValue({
      complianceReportId: 'testReportId',
      compliancePeriod: '2024'
    })

    // Mock useGetAllocationAgreements hook to return empty data initially
    vi.mocked(
      useAllocationAgreementHook.useGetAllAllocationAgreements
    ).mockReturnValue({
      data: { allocationAgreements: [] },
      isLoading: false
    })

    // Add this missing mock for useGetAllocationAgreementsList
    vi.mocked(
      useAllocationAgreementHook.useGetAllocationAgreementsList
    ).mockReturnValue({
      data: { allocationAgreements: [] },
      isLoading: false
    })

    // Mock useAllocationAgreementOptions hook
    vi.mocked(
      useAllocationAgreementHook.useAllocationAgreementOptions
    ).mockReturnValue({
      data: { fuelTypes: [] },
      isLoading: false,
      isFetched: true
    })

    // Mock useSaveAllocationAgreement hook
    vi.mocked(
      useAllocationAgreementHook.useSaveAllocationAgreement
    ).mockReturnValue({
      mutateAsync: vi.fn()
    })

    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 1 }
      }
    })

    useGetComplianceReport.mockImplementation((id) => {
      return { data: { report: { version: 0 } } }
    })
  })

  it('renders the component', () => {
    render(<AddEditAllocationAgreements />, { wrapper })
    expect(
      screen.getByText('allocationAgreement:allocationAgreementTitle')
    ).toBeInTheDocument()
  })

  it('initializes with at least one row in the empty state', () => {
    render(<AddEditAllocationAgreements />, { wrapper })
    const rows = screen.getAllByTestId('grid-row')
    expect(rows.length).toBe(1) // Ensure at least one row exists
  })

  it('loads data when allocationAgreements are available', async () => {
    const mockData = {
      allocationAgreements: [
        { allocationAgreementId: 'testId1' },
        { allocationAgreementId: 'testId2' }
      ]
    }

    vi.mocked(
      useAllocationAgreementHook.useGetAllAllocationAgreements
    ).mockReturnValue({
      data: mockData,
      isLoading: false
    })

    vi.mocked(
      useAllocationAgreementHook.useGetAllocationAgreementsList
    ).mockReturnValue({
      data: mockData,
      isLoading: false
    })

    render(<AddEditAllocationAgreements />, { wrapper })

    // Use findAllByTestId for asynchronous elements
    const rows = await screen.findAllByTestId('grid-row')
    expect(rows.length).toBe(2)
    // Check that each row's textContent matches UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    rows.forEach((row) => {
      expect(uuidRegex.test(row.textContent)).toBe(true)
    })
  })
})