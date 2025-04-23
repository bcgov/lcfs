import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ComplianceReportSummary from '../ComplianceReportSummary'
import {
  useGetComplianceReportSummary,
  useUpdateComplianceReportSummary
} from '@/hooks/useComplianceReports'
import { wrapper } from '@/tests/utils/wrapper'
import ComplianceReportEarlyIssuanceSummary from '@/views/ComplianceReports/components/ComplianceReportEarlyIssuanceSummary.jsx'

// Mock the custom hooks and components
vi.mock('@/hooks/useComplianceReports')
vi.mock('../SummaryTable', () => ({ default: () => <div>SummaryTable</div> }))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: vi.fn().mockReturnValue({
    keycloak: { authenticated: true }
  })
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

vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn()
  })
}))

describe('ComplianceReportSummary', () => {
  const mockReportID = '123'
  const mockReportData = {
    report: {
      complianceReportId: mockReportID
    }
  }

  beforeAll(() => {
    useUpdateComplianceReportSummary.mockReturnValue({})
  })

  it('renders loading state', () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: true,
      isError: false,
      data: null
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      {
        wrapper
      }
    )
    expect(
      screen.getByText('Loading compliance report summary...')
    ).toBeInTheDocument()
  })

  it('renders summary content', async () => {
    useGetComplianceReportSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        earlyIssuanceSummary: [
          { line: 'Q1', value: 3333 },
          { line: 'Q2', value: 50 },
          { line: 'Q3', value: 50 },
          { line: 'Q4', value: 30 }
        ]
      }
    })

    render(
      <ComplianceReportEarlyIssuanceSummary reportData={mockReportData} />,
      {
        wrapper
      }
    )

    await waitFor(() => {
      expect(screen.getByTestId('accordion')).toBeInTheDocument()
      expect(screen.getByTestId('accordion-summary')).toBeInTheDocument()
      expect(screen.getByTestId('accordion-details')).toBeInTheDocument()
      expect(screen.getByText('Summary & declaration')).toBeInTheDocument()
      expect(screen.getAllByText('SummaryTable')).toHaveLength(1)
    })
  })
})
