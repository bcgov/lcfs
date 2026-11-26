import 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vite-plus/test'
import ComplianceReportEarlyIssuanceSummary from '../ComplianceReportEarlyIssuanceSummary'
import type { ReactNode } from 'react'

const { mockGetSummary, mockUseTranslation } = vi.hoisted(() => ({
  mockGetSummary: vi.fn(),
  mockUseTranslation: vi.fn()
}))

// Mock the custom hooks and components
vi.mock('@/hooks/useComplianceReports', () => ({
  useGetComplianceReportSummary: mockGetSummary
}))
vi.mock('react-i18next', () => ({ useTranslation: mockUseTranslation }))
vi.mock('../SummaryTable', () => ({
  default: (props: { 'data-test'?: string; title?: string }) => (
    <div data-test={props['data-test']}>SummaryTable: {props.title}</div>
  )
}))
vi.mock('../_schema', () => ({
  earlyIssuanceColumns: vi.fn(() => ['column1', 'column2'])
}))

// Mock components
vi.mock('@/components/BCTypography', () => ({
  default: ({ children }: { children?: ReactNode }) => (
    <div data-test="bc-typography">{children}</div>
  )
}))
vi.mock('@/components/Loading', () => ({
  default: ({ message }: { message?: string }) => (
    <div data-test="loading">{message}</div>
  )
}))

// Mock MUI components
vi.mock('@mui/material/Accordion', () => ({
  default: ({ children }: { children?: ReactNode }) => (
    <div data-test="accordion">{children}</div>
  )
}))

vi.mock('@mui/material/AccordionSummary', () => ({
  default: ({
    children,
    expandIcon
  }: {
    children?: ReactNode
    expandIcon?: ReactNode
  }) => (
    <div data-test="accordion-summary">
      {children}
      {expandIcon && <span data-test="expand-icon">{expandIcon}</span>}
    </div>
  )
}))

vi.mock('@mui/material/AccordionDetails', () => ({
  default: ({ children }: { children?: ReactNode }) => (
    <div data-test="accordion-details">{children}</div>
  )
}))

vi.mock('@mui/icons-material/ExpandMore', () => ({
  default: () => <div data-test="expand-more-icon">ExpandMore</div>
}))

describe('ComplianceReportEarlyIssuanceSummary', () => {
  const mockTranslation = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      'report:summaryLoadingMsg': 'Loading compliance report summary...',
      'report:summaryAndDeclaration': 'Summary & declaration',
      'report:nonCompliancePenaltySummary': 'Non-compliance penalty summary'
    }
    return translations[key] || key
  })

  const mockReportData = {
    report: {
      complianceReportId: 123
    }
  }

  const mockSummaryData = {
    earlyIssuanceSummary: [
      { line: 'Q1', value: 100 },
      { line: 'Q2', value: 200 }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTranslation.mockReturnValue({ t: mockTranslation })
  })

  it('renders loading state when isLoading is true', () => {
    mockGetSummary.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(
      screen.getByText('Loading compliance report summary...')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('accordion')).not.toBeInTheDocument()
  })

  it('renders main content when not loading', () => {
    mockGetSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    expect(screen.getByTestId('accordion')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-summary')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-details')).toBeInTheDocument()
  })

  it('calls useTranslation with correct namespace', () => {
    mockGetSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(mockUseTranslation).toHaveBeenCalledWith(['report'])
  })

  it('calls useGetComplianceReportSummary with correct reportId', () => {
    mockGetSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(mockGetSummary).toHaveBeenCalledWith(123)
  })

  it('handles undefined reportData gracefully', () => {
    mockGetSummary.mockReturnValue({
      data: null,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={undefined} />)

    expect(mockGetSummary).toHaveBeenCalledWith(undefined)
    expect(screen.getByTestId('accordion')).toBeInTheDocument()
  })

  it('handles null reportData gracefully', () => {
    mockGetSummary.mockReturnValue({
      data: null,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={null} />)

    expect(mockGetSummary).toHaveBeenCalledWith(undefined)
    expect(screen.getByTestId('accordion')).toBeInTheDocument()
  })

  it('renders accordion structure correctly', () => {
    mockGetSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(screen.getByTestId('accordion')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-summary')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-details')).toBeInTheDocument()
  })

  it('renders AccordionSummary with expand icon and text', () => {
    mockGetSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(screen.getByTestId('expand-more-icon')).toBeInTheDocument()
    expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
  })

  it('renders BCTypography component with text', () => {
    mockGetSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
    expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
  })

  it('renders SummaryTable with correct attributes', () => {
    mockGetSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(screen.getByTestId('early-issuance-summary')).toBeInTheDocument()
    expect(
      screen.getByText('SummaryTable: Non-compliance penalty summary')
    ).toBeInTheDocument()
  })

  it('renders SummaryTable when data is available', () => {
    mockGetSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(screen.getByTestId('early-issuance-summary')).toBeInTheDocument()
  })

  it('renders SummaryTable when data is empty', () => {
    mockGetSummary.mockReturnValue({
      data: {},
      isLoading: false
    })

    render(<ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />)

    expect(screen.getByTestId('early-issuance-summary')).toBeInTheDocument()
  })
})
