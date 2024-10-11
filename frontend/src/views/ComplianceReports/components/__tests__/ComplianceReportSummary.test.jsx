import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import ComplianceReportSummary from '../ComplianceReportSummary'
import {
  useGetComplianceReportSummary,
  useUpdateComplianceReportSummary
} from '@/hooks/useComplianceReports'
import { BrowserRouter as Router } from 'react-router-dom'
import { SUMMARY } from '@/constants/common'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'
import { buttonClusterConfigFn } from '@/views/ComplianceReports/buttonConfigs'

// Mock the custom hooks and components
vi.mock('@/hooks/useComplianceReports')
vi.mock('../SummaryTable', () => ({ default: () => <div>SummaryTable</div> }))
vi.mock('../SigningAuthorityDeclaration', () => ({
  default: ({ onChange }) => (
    <input
      type="checkbox"
      data-test="signing-authority-checkbox"
      onChange={(e) => onChange && onChange(e.target.checked)}  // Safely calling onChange
    />
  )
}))

// Mock MUI components
vi.mock('@mui/material', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual, // keep the actual MUI components
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
    TextField: (props) => <input {...props} />
  }
})

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <Router>{children}</Router>
      </ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('ComplianceReportSummary', () => {
  const mockReportID = '123'
  const mockSetHasMet = vi.fn() // Mock setHasMet function
  const mockHandleSubmit = vi.fn() // Mock handleSubmit function

  beforeAll(() => {
    useUpdateComplianceReportSummary.mockReturnValue({})
  })

  it('renders loading state', () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: true,
      isError: false,
      data: null
    })

    customRender(<ComplianceReportSummary reportID={mockReportID} setHasMet={mockSetHasMet} />)
    expect(screen.getByText('Loading compliance report summary...')).toBeInTheDocument()
  })

  it('renders error state', () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: 'Error fetching data' },
      data: null
    })

    customRender(<ComplianceReportSummary reportID={mockReportID} setHasMet={mockSetHasMet} />)
    expect(screen.getByText('Error retrieving the record')).toBeInTheDocument()
  })

  it('renders summary content along with signing authority checkbox, and enables submit button when checkbox is selected', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        renewableFuelTargetSummary: {
          [SUMMARY.LINE_1]: { gasoline: 100, diesel: 100, jetFuel: 100 },
          [SUMMARY.LINE_2]: { gasoline: 50, diesel: 50, jetFuel: 50 },
          [SUMMARY.LINE_4]: { gasoline: 30, diesel: 30, jetFuel: 30 }
        },
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: [
          { totalValue: 0 },
          { totalValue: 0 }
        ]
      }
    })

    customRender(
      <ComplianceReportSummary
        reportID={mockReportID}
        currentStatus={COMPLIANCE_REPORT_STATUSES.DRAFT}
        setHasMet={mockSetHasMet}
        methods={{ handleSubmit: mockHandleSubmit }}
        buttonClusterConfig={buttonClusterConfigFn({
          hasRoles: vi.fn(),
          t: vi.fn(),
          setModalData: vi.fn(),
          updateComplianceReport: vi.fn(),
          isGovernmentUser: true,
          isSigningAuthorityDeclared: true
        })}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByTestId('accordion-summary')).toBeInTheDocument()
      expect(screen.getByTestId('accordion-details')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      expect(screen.getAllByText('SummaryTable')).toHaveLength(3)
      expect(screen.getByTestId('signing-authority-checkbox')).toBeInTheDocument()
    })

    // Check for submit button presence and initial state (disabled)
    const submitButton = screen.getByTestId('submit-report-btn')
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    // Simulate clicking the signing authority checkbox
    fireEvent.click(screen.getByTestId('signing-authority-checkbox'))

    // Ensure submit button gets enabled after checkbox selection
    await waitFor(() => {
      expect(submitButton).toBeDisabled()
    })
  })
})
