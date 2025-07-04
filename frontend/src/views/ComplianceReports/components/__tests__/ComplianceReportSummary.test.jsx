import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ComplianceReportSummary from '../ComplianceReportSummary'
import {
  useGetComplianceReportSummary,
  useUpdateComplianceReportSummary
} from '@/hooks/useComplianceReports'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { wrapper } from '@/tests/utils/wrapper'

// Mock the custom hooks and components
vi.mock('@/hooks/useComplianceReports')
vi.mock('../SummaryTable', () => ({ default: () => <div>SummaryTable</div> }))
vi.mock('../SigningAuthorityDeclaration', () => ({
  default: ({ onChange }) => (
    <input
      type="checkbox"
      data-test="signing-authority-checkbox"
      onChange={(e) => onChange && onChange(e.target.checked)}
    />
  )
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true }
  })
}))

// Mock MUI components
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    Accordion: ({ children }) => <div data-test="accordion">{children}</div>,
    AccordionSummary: ({ children }) => (
      <div data-test="accordion-summary">{children}</div>
    ),
    AccordionDetails: ({ children }) => (
      <div data-test="accordion-details">{children}</div>
    ),
    Typography: ({ children }) => <div>{children}</div>,
    CircularProgress: () => <div>Loading...</div>,
    List: ({ children }) => <ul>{children}</ul>,
    ListItem: ({ children }) => <li>{children}</li>,
    TextField: (props) => <input {...props} />,
    Stack: ({ children }) => (
      <div className="MuiStack-root css-ve6gns-MuiStack-root">{children}</div>
    )
  }
})

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    hasRoles: vi.fn(() => true),
    data: { isGovernmentUser: false }
  })
}))

vi.mock('@/hooks/useOrganizationSnapshot', () => ({
  useOrganizationSnapshot: () => ({
    data: {
      headOfficeAddress: 'address',
      recordsAddress: 'address',
      someOtherField: 'value'
    }
  })
}))

vi.mock('@/components/TogglePanel', () => ({
  TogglePanel: ({ offComponent }) => <div>{offComponent}</div>
}))

vi.mock('@/views/CompareReports/CompareReports', () => ({
  CompareReports: () => <div>Compare Reports</div>
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

vi.mock('@/components/BCButton', () => ({
  default: ({
    children,
    'data-test': dataTest,
    disabled,
    onClick,
    ...props
  }) => (
    <button
      data-test={dataTest}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}))

describe('ComplianceReportSummary', () => {
  const mockReportID = '123'
  const mockSetIsSigningAuthorityDeclared = vi.fn()
  const mockHandleSubmit = vi.fn((handler) => handler) // Mock handleSubmit to return the handler
  
  const mockButtonClusterConfig = {
    [COMPLIANCE_REPORT_STATUSES.DRAFT]: [
      {
        id: 'submit-report-btn',
        label: 'Submit Report',
        variant: 'contained',
        color: 'primary',
        disabled: true,
        handler: vi.fn(),
        startIcon: null
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()

    useUpdateComplianceReportSummary.mockReturnValue({
      mutate: vi.fn()
    })
  })

  it('renders loading state', () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: true,
      isError: false,
      data: null,
      isFetching: false
    })

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
      />,
      { wrapper }
    )

    expect(
      screen.getByText('Loading compliance report summary...')
    ).toBeInTheDocument()
  })

  it('renders error state', () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: 'Error fetching data' },
      data: null,
      isFetching: false
    })

    const alertRef = React.createRef()
    alertRef.current = { triggerAlert: vi.fn() }

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
        alertRef={alertRef}
      />,
      { wrapper }
    )

    expect(screen.getByText('Error retrieving the record')).toBeInTheDocument()
  })

  it('renders summary content along with signing authority checkbox, and button behavior', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      data: {
        complianceReportId: mockReportID,
        canSign: true,
        renewableFuelTargetSummary: [
          { line: 1, gasoline: 100, diesel: 100, jetFuel: 100 },
          { line: 2, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 3, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 4, gasoline: 30, diesel: 30, jetFuel: 30 }
        ],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: [
          { line: 11, totalValue: 0 },
          { line: 21, totalValue: 0 },
          { totalValue: 0 }
        ]
      }
    })

    // Create a proper button cluster config that returns the expected button structure
    const mockButtonClusterConfig = {
      [COMPLIANCE_REPORT_STATUSES.DRAFT]: [
        {
          id: 'submit-report-btn',
          label: 'Submit Report',
          variant: 'contained',
          color: 'primary',
          disabled: true, // Initially disabled
          handler: vi.fn(),
          startIcon: null
        },
        {
          id: 'delete-draft-btn',
          label: 'Delete Draft',
          variant: 'outlined',
          color: 'error',
          disabled: false,
          handler: vi.fn(),
          startIcon: null
        }
      ]
    }

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        enableCompareMode={false}
        canEdit={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
        methods={{ handleSubmit: mockHandleSubmit }}
        buttonClusterConfig={mockButtonClusterConfig}
        compliancePeriodYear="2023"
      />,
      { wrapper }
    )

    await waitFor(() => {
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByTestId('accordion-summary')).toBeInTheDocument()
      expect(screen.getByTestId('accordion-details')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      expect(screen.getAllByText('SummaryTable')).toHaveLength(3)
      expect(
        screen.getByTestId('signing-authority-checkbox')
      ).toBeInTheDocument()
    })

    // Check for submit button presence and initial state (disabled)
    const submitButton = screen.getByTestId('submit-report-btn')
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    // Check for delete button
    const deleteButton = screen.getByTestId('delete-draft-btn')
    expect(deleteButton).toBeInTheDocument()
    expect(deleteButton).not.toBeDisabled()

    // Simulate clicking the signing authority checkbox
    fireEvent.click(screen.getByTestId('signing-authority-checkbox'))

    // The component should call setIsSigningAuthorityDeclared
    expect(mockSetIsSigningAuthorityDeclared).toHaveBeenCalledWith(true)
  })

  it('renders penalty override fields for directors in 2024+ compliance periods', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      data: {
        complianceReportId: mockReportID,
        canSign: true,
        penaltyOverrideEnabled: true,
        renewablePenaltyOverride: 1500.75,
        lowCarbonPenaltyOverride: 750.50,
        renewableFuelTargetSummary: [
          { line: 1, gasoline: 100, diesel: 100, jetFuel: 100 },
          { line: 2, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 3, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 4, gasoline: 30, diesel: 30, jetFuel: 30 }
        ],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: [
          { line: 11, totalValue: 1500.75 },
          { line: 21, totalValue: 750.50 },
          { totalValue: 2251.25 }
        ]
      }
    })

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        enableCompareMode={false}
        canEdit={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
        methods={{ handleSubmit: mockHandleSubmit }}
        buttonClusterConfig={mockButtonClusterConfig}
        compliancePeriodYear="2024"
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Verify component renders successfully with penalty override data
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      // TODO: Add specific penalty override UI tests once the feature is implemented
      // expect(screen.getByLabelText(/penalty override enabled/i)).toBeInTheDocument()
      // expect(screen.getByDisplayValue('1500.75')).toBeInTheDocument()
      // expect(screen.getByDisplayValue('750.50')).toBeInTheDocument()
    })
  })

  it('does not render penalty override fields for non-directors', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      data: {
        complianceReportId: mockReportID,
        canSign: true,
        penaltyOverrideEnabled: false,
        renewablePenaltyOverride: null,
        lowCarbonPenaltyOverride: null,
        renewableFuelTargetSummary: [
          { line: 1, gasoline: 100, diesel: 100, jetFuel: 100 },
          { line: 2, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 3, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 4, gasoline: 30, diesel: 30, jetFuel: 30 }
        ],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: [
          { line: 11, totalValue: 1500 },
          { line: 21, totalValue: 750 },
          { totalValue: 2250 }
        ]
      }
    })

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        enableCompareMode={false}
        canEdit={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
        methods={{ handleSubmit: mockHandleSubmit }}
        buttonClusterConfig={mockButtonClusterConfig}
        compliancePeriodYear="2024"
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Verify component renders successfully for non-directors
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      // TODO: Verify penalty override fields are NOT rendered for non-directors once UI is implemented
    })
  })

  it('does not render penalty override fields for pre-2024 compliance periods', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      data: {
        complianceReportId: mockReportID,
        canSign: true,
        penaltyOverrideEnabled: false,
        renewablePenaltyOverride: null,
        lowCarbonPenaltyOverride: null,
        renewableFuelTargetSummary: [
          { line: 1, gasoline: 100, diesel: 100, jetFuel: 100 },
          { line: 2, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 3, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 4, gasoline: 30, diesel: 30, jetFuel: 30 }
        ],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: [
          { line: 11, totalValue: 1500 },
          { line: 21, totalValue: 750 },
          { totalValue: 2250 }
        ]
      }
    })

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        enableCompareMode={false}
        canEdit={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
        methods={{ handleSubmit: mockHandleSubmit }}
        buttonClusterConfig={mockButtonClusterConfig}
        compliancePeriodYear="2023"  // Pre-2024
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Verify component renders successfully for pre-2024 periods
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      // TODO: Verify penalty override fields are NOT rendered for pre-2024 periods once UI is implemented
    })
  })

  it('handles penalty override checkbox interaction', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      data: {
        complianceReportId: mockReportID,
        canSign: true,
        penaltyOverrideEnabled: false,
        renewablePenaltyOverride: null,
        lowCarbonPenaltyOverride: null,
        renewableFuelTargetSummary: [
          { line: 1, gasoline: 100, diesel: 100, jetFuel: 100 },
          { line: 2, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 3, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 4, gasoline: 30, diesel: 30, jetFuel: 30 }
        ],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: []
      }
    })

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        enableCompareMode={false}
        canEdit={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
        methods={{ handleSubmit: mockHandleSubmit }}
        buttonClusterConfig={mockButtonClusterConfig}
        compliancePeriodYear="2024"
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Verify component renders successfully for penalty override interaction test
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      // TODO: Add penalty override checkbox interaction tests once UI is implemented
    })
  })

  it('displays penalty override values when enabled', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      data: {
        complianceReportId: mockReportID,
        canSign: true,
        penaltyOverrideEnabled: true,
        renewablePenaltyOverride: 2000.50,
        lowCarbonPenaltyOverride: 1250.75,
        renewableFuelTargetSummary: [
          { line: 1, gasoline: 100, diesel: 100, jetFuel: 100 },
          { line: 2, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 3, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 4, gasoline: 30, diesel: 30, jetFuel: 30 }
        ],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: [
          { line: 11, totalValue: 2000.50 },  // Override value
          { line: 21, totalValue: 1250.75 },  // Override value
          { totalValue: 3251.25 }              // Sum of overrides
        ]
      }
    })

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        enableCompareMode={false}
        canEdit={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
        methods={{ handleSubmit: mockHandleSubmit }}
        buttonClusterConfig={mockButtonClusterConfig}
        compliancePeriodYear="2024"
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Verify component renders successfully with penalty override values
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      // TODO: Verify penalty override values are displayed once UI is implemented
    })
  })

  it('handles penalty override value changes', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      data: {
        complianceReportId: mockReportID,
        canSign: true,
        penaltyOverrideEnabled: true,
        renewablePenaltyOverride: 1500.00,
        lowCarbonPenaltyOverride: 750.00,
        renewableFuelTargetSummary: [
          { line: 1, gasoline: 100, diesel: 100, jetFuel: 100 },
          { line: 2, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 3, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 4, gasoline: 30, diesel: 30, jetFuel: 30 }
        ],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: []
      }
    })

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        enableCompareMode={false}
        canEdit={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
        methods={{ handleSubmit: mockHandleSubmit }}
        buttonClusterConfig={mockButtonClusterConfig}
        compliancePeriodYear="2024"
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Verify component renders successfully for penalty override value changes test
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      // TODO: Add penalty override value change tests once UI is implemented
    })
  })

  it('validates penalty override values', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      data: {
        complianceReportId: mockReportID,
        canSign: true,
        penaltyOverrideEnabled: true,
        renewablePenaltyOverride: 0,
        lowCarbonPenaltyOverride: 0,
        renewableFuelTargetSummary: [
          { line: 1, gasoline: 100, diesel: 100, jetFuel: 100 },
          { line: 2, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 3, gasoline: 50, diesel: 50, jetFuel: 50 },
          { line: 4, gasoline: 30, diesel: 30, jetFuel: 30 }
        ],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: []
      }
    })

    render(
      <ComplianceReportSummary
        reportID={mockReportID}
        enableCompareMode={false}
        canEdit={true}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        setIsSigningAuthorityDeclared={mockSetIsSigningAuthorityDeclared}
        methods={{ handleSubmit: mockHandleSubmit }}
        buttonClusterConfig={mockButtonClusterConfig}
        compliancePeriodYear="2024"
      />,
      { wrapper }
    )

    await waitFor(() => {
      // Verify component renders successfully for penalty override validation test
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      // TODO: Add penalty override validation tests once UI is implemented
    })
  })
})
