import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import ComplianceReportSummary from '../ComplianceReportSummary'
import { useGetComplianceReportSummary } from '@/hooks/useComplianceReports'

// Mock the custom hooks and components
vi.mock('@/hooks/useComplianceReports')
vi.mock('../SummaryTable', () => ({ default: () => <div>SummaryTable</div> }))
vi.mock('../SigningAuthorityDeclaration', () => ({ default: () => <div>SigningAuthorityDeclaration</div> }))

// Mock MUI components
vi.mock('@mui/material', () => ({
  Accordion: ({ children }) => <div data-testid="accordion">{children}</div>,
  AccordionSummary: ({ children }) => <div data-testid="accordion-summary">{children}</div>,
  AccordionDetails: ({ children }) => <div data-testid="accordion-details">{children}</div>,
  Typography: ({ children }) => <div>{children}</div>,
  CircularProgress: () => <div>Loading...</div>,
  List: ({ children }) => <ul>{children}</ul>,
  ListItem: ({ children }) => <li>{children}</li>,
}))

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('ComplianceReportSummary', () => {
  const mockReportID = '123'

  it('renders loading state', () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: true,
      isError: false,
      data: null,
    })

    customRender(<ComplianceReportSummary reportID={mockReportID} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders error state', () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: 'Error fetching data' },
      data: null,
    })

    customRender(<ComplianceReportSummary reportID={mockReportID} />)
    expect(screen.getByText('Error fetching data')).toBeInTheDocument()
  })

  it('renders summary content when data is loaded', () => {
    const mockData = {
      renewableFuelTargetSummary: [],
      lowCarbonFuelTargetSummary: [],
      nonCompliancePenaltySummary: [],
    }

    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockData,
    })

    customRender(<ComplianceReportSummary reportID={mockReportID} />)
    
    waitFor(() => {
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByTestId('accordion-summary')).toBeInTheDocument()
      expect(screen.getByTestId('accordion-details')).toBeInTheDocument()
      expect(screen.getByText('Summary & Declaration')).toBeInTheDocument()
      expect(screen.getByText('Add a renewable fuel retention or obligation deferral')).toBeInTheDocument()
      expect(screen.getAllByText('SummaryTable')).toHaveLength(3)
      expect(screen.getByText('SigningAuthorityDeclaration')).toBeInTheDocument()
    })
  })
})