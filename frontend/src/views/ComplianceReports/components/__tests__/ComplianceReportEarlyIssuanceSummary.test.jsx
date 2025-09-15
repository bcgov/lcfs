import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import ComplianceReportEarlyIssuanceSummary from '../ComplianceReportEarlyIssuanceSummary'
import { useGetComplianceReportSummary } from '@/hooks/useComplianceReports'
import { useTranslation } from 'react-i18next'
import { wrapper } from '@/tests/utils/wrapper'

// Mock the custom hooks and components
vi.mock('@/hooks/useComplianceReports')
vi.mock('react-i18next')
vi.mock('../SummaryTable', () => ({ 
  default: (props) => (
    <div data-test={props['data-test']}>
      SummaryTable: {props.title}
    </div>
  ) 
}))
vi.mock('../_schema', () => ({
  earlyIssuanceColumns: vi.fn((t) => ['column1', 'column2'])
}))

// Mock components
vi.mock('@/components/BCTypography', () => ({
  default: ({ children }) => <div data-test="bc-typography">{children}</div>
}))
vi.mock('@/components/Loading', () => ({
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

// Mock MUI components
vi.mock('@mui/material', () => ({
  Accordion: ({ children }) => <div data-test="accordion">{children}</div>,
  AccordionSummary: ({ children, expandIcon }) => (
    <div data-test="accordion-summary">
      {children}
      {expandIcon && <span data-test="expand-icon">{expandIcon}</span>}
    </div>
  ),
  AccordionDetails: ({ children }) => (
    <div data-test="accordion-details">{children}</div>
  )
}))

vi.mock('@mui/icons-material', () => ({
  ExpandMore: (props) => <div data-test="expand-more-icon">ExpandMore</div>
}))

describe('ComplianceReportEarlyIssuanceSummary', () => {
  const mockTranslation = vi.fn((key) => {
    const translations = {
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
    useTranslation.mockReturnValue({ t: mockTranslation })
  })

  it('renders loading state when isLoading is true', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: null,
      isLoading: true
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('Loading compliance report summary...')).toBeInTheDocument()
    expect(screen.queryByTestId('accordion')).not.toBeInTheDocument()
  })

  it('renders main content when not loading', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    expect(screen.getByTestId('accordion')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-summary')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-details')).toBeInTheDocument()
  })

  it('calls useTranslation with correct namespace', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(useTranslation).toHaveBeenCalledWith(['report'])
  })

  it('calls useGetComplianceReportSummary with correct reportId', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(useGetComplianceReportSummary).toHaveBeenCalledWith(123)
  })

  it('handles undefined reportData gracefully', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: null,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={undefined} />,
      { wrapper }
    )

    expect(useGetComplianceReportSummary).toHaveBeenCalledWith(undefined)
    expect(screen.getByTestId('accordion')).toBeInTheDocument()
  })

  it('handles null reportData gracefully', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: null,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={null} />,
      { wrapper }
    )

    expect(useGetComplianceReportSummary).toHaveBeenCalledWith(undefined)
    expect(screen.getByTestId('accordion')).toBeInTheDocument()
  })

  it('renders accordion structure correctly', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(screen.getByTestId('accordion')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-summary')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-details')).toBeInTheDocument()
  })

  it('renders AccordionSummary with expand icon and text', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(screen.getByTestId('expand-more-icon')).toBeInTheDocument()
    expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
  })

  it('renders BCTypography component with text', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(screen.getByTestId('bc-typography')).toBeInTheDocument()
    expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
  })

  it('renders SummaryTable with correct attributes', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(screen.getByTestId('early-issuance-summary')).toBeInTheDocument()
    expect(screen.getByText('SummaryTable: Non-compliance penalty summary')).toBeInTheDocument()
  })

  it('renders SummaryTable when data is available', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(screen.getByTestId('early-issuance-summary')).toBeInTheDocument()
  })

  it('renders SummaryTable when data is empty', () => {
    useGetComplianceReportSummary.mockReturnValue({
      data: {},
      isLoading: false
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      { wrapper }
    )

    expect(screen.getByTestId('early-issuance-summary')).toBeInTheDocument()
  })
})