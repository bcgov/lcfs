import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AddEditAllocationAgreements } from '../AddEditAllocationAgreements'
import * as useAllocationAgreementHook from '@/hooks/useAllocationAgreement'
import { useGetComplianceReport } from '@/hooks/useComplianceReports'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { wrapper } from '@/tests/utils/wrapper'
import * as configModule from '@/constants/config'

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
  useParams: () => mockUseParams()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: vi.fn((key, options = {}) => {
      if (
        key === 'allocationAgreement:allocationAgreementGuides' &&
        options.returnObjects
      ) {
        return ['Guide 1', 'Guide 2', 'Guide 3']
      }
      return key
    })
  })
}))

vi.mock('@/hooks/useAllocationAgreement')

vi.mock('@/constants/config', () => ({
  FEATURE_FLAGS: {
    ALLOCATION_AGREEMENT_IMPORT_EXPORT: 'ALLOCATION_AGREEMENT_IMPORT_EXPORT'
  },
  isFeatureEnabled: vi.fn()
}))

vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    download: vi.fn()
  })
}))

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

vi.mock('@/components/ImportDialog', () => ({
  default: ({ open, close }) => (
    <div data-testid="import-dialog" aria-hidden={!open}>
      <button onClick={close} data-testid="close-dialog">
        Close
      </button>
    </div>
  )
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    setForbidden: vi.fn()
  })
}))

describe('AddEditAllocationAgreements', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    mockUseLocation.mockReturnValue({
      pathname: '/test-path',
      state: {}
    })
    mockUseNavigate.mockReturnValue(vi.fn())
    mockUseParams.mockReturnValue({
      complianceReportId: 'testReportId',
      compliancePeriod: '2024'
    })

    vi.mocked(
      useAllocationAgreementHook.useGetAllAllocationAgreements
    ).mockReturnValue({
      data: { allocationAgreements: [] },
      isLoading: false,
      refetch: vi.fn()
    })

    vi.mocked(
      useAllocationAgreementHook.useAllocationAgreementOptions
    ).mockReturnValue({
      data: { fuelTypes: [] },
      isLoading: false,
      isFetched: true
    })

    vi.mocked(
      useAllocationAgreementHook.useSaveAllocationAgreement
    ).mockReturnValue({
      mutateAsync: vi.fn()
    })

    vi.mocked(
      useAllocationAgreementHook.useImportAllocationAgreement
    ).mockReturnValue({
      mutateAsync: vi.fn()
    })

    vi.mocked(
      useAllocationAgreementHook.useGetAllocationAgreementImportJobStatus
    ).mockReturnValue({
      data: null,
      isLoading: false
    })

    useCurrentUser.mockReturnValue({
      data: {
        organization: { organizationId: 1, name: 'Test Org' }
      },
      isLoading: false
    })

    useGetComplianceReport.mockImplementation(() => {
      return {
        data: { report: { version: 0 } },
        isLoading: false
      }
    })

    vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)
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
    expect(rows.length).toBe(1)
  })

  it('loads data when allocationAgreements are available', async () => {
    vi.mocked(
      useAllocationAgreementHook.useGetAllAllocationAgreements
    ).mockReturnValue({
      data: {
        allocationAgreements: [
          { allocationAgreementId: 'testId1' },
          { allocationAgreementId: 'testId2' }
        ]
      },
      isLoading: false,
      refetch: vi.fn()
    })

    render(<AddEditAllocationAgreements />, { wrapper })

    const rows = await screen.findAllByTestId('grid-row')
    expect(rows.length).toBe(2)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    rows.forEach((row) => {
      expect(uuidRegex.test(row.textContent)).toBe(true)
    })
  })

  it('does not show import/export buttons when feature flag is disabled', () => {
    vi.mocked(configModule.isFeatureEnabled).mockReturnValue(false)

    render(<AddEditAllocationAgreements />, { wrapper })

    expect(
      screen.queryByText('common:importExport.export.btn')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('common:importExport.import.btn')
    ).not.toBeInTheDocument()
  })

  it('shows import/export buttons when feature flag is enabled', () => {
    vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

    render(<AddEditAllocationAgreements />, { wrapper })

    expect(
      screen.getByText('common:importExport.export.btn')
    ).toBeInTheDocument()
    expect(
      screen.getByText('common:importExport.import.btn')
    ).toBeInTheDocument()
  })

  it('hides overwrite option for supplemental reports with existing data', () => {
    useGetComplianceReport.mockImplementation(() => {
      return {
        data: { report: { version: 1 } },
        isLoading: false
      }
    })

    vi.mocked(
      useAllocationAgreementHook.useGetAllAllocationAgreements
    ).mockReturnValue({
      data: {
        allocationAgreements: [{ allocationAgreementId: 'testId1' }]
      },
      isLoading: false,
      refetch: vi.fn()
    })

    vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

    render(<AddEditAllocationAgreements />, { wrapper })

    fireEvent.click(screen.getByText('common:importExport.import.btn'))

    expect(
      screen.queryByText('common:importExport.import.dialog.buttons.overwrite')
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('common:importExport.import.dialog.buttons.append')
    ).toBeInTheDocument()
  })

  it('shows both import options for original reports', () => {
    useGetComplianceReport.mockImplementation(() => {
      return {
        data: { report: { version: 0 } },
        isLoading: false
      }
    })

    vi.mocked(configModule.isFeatureEnabled).mockReturnValue(true)

    render(<AddEditAllocationAgreements />, { wrapper })

    fireEvent.click(screen.getByText('common:importExport.import.btn'))

    expect(
      screen.getByText('common:importExport.import.dialog.buttons.overwrite')
    ).toBeInTheDocument()
    expect(
      screen.getByText('common:importExport.import.dialog.buttons.append')
    ).toBeInTheDocument()
  })
})
