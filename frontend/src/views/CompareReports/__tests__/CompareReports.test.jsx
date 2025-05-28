import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useGetComplianceReport,
  useGetComplianceReportSummary
} from '@/hooks/useComplianceReports'
import { CompareReports } from '@/views/CompareReports/CompareReports'
import { wrapper } from '@/tests/utils/wrapper'

// Mock hooks
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useComplianceReports')

describe('CompareReports Component', () => {
  beforeEach(() => {
    useCurrentUser.mockReturnValue({
      hasRoles: true,
      data: { organization: { organizationId: 1 } },
      isLoading: false
    })

    useGetComplianceReport.mockReturnValue({
      data: {
        chain: [
          {
            nickname: 'Original Report',
            complianceReportId: 1,
            timestamp: '2021-01-01'
          },
          {
            nickname: 'Supplemental Report 1',
            complianceReportId: 2,
            timestamp: '2021-02-01'
          },
          {
            nickname: 'Government Adjustment 2',
            complianceReportId: 3,
            timestamp: '2021-03-01'
          }
        ],
        report: {
          compliancePeriod: '2021',
          complianceReportId: 3
        }
      }
    })

    const reportData1 = {
      data: {
        complianceReportId: 1,
        renewableFuelTargetSummary: [
          {
            line: 1,
            description: 'renewableFuelTargetSummary',
            format: 'number',
            gasoline: 100
          }
        ],
        lowCarbonFuelTargetSummary: [
          {
            line: 1,
            description: 'lowCarbonFuelTargetSummary',
            format: 'number',
            value: 50
          }
        ],
        nonCompliancePenaltySummary: [
          {
            line: 1,
            description: 'nonCompliancePenaltySummary',
            format: 'number',
            value: 98
          }
        ]
      }
    }

    const reportData2 = {
      data: {
        complianceReportId: 2,
        renewableFuelTargetSummary: [
          {
            line: 1,
            description: 'renewableFuelTargetSummary',
            format: 'number',
            gasoline: 250
          }
        ],
        lowCarbonFuelTargetSummary: [
          {
            line: 1,
            description: 'lowCarbonFuelTargetSummary',
            format: 'number',
            value: 70
          }
        ],
        nonCompliancePenaltySummary: [
          {
            line: 1,
            description: 'nonCompliancePenaltySummary',
            format: 'number',
            value: 99
          }
        ]
      }
    }

    const reportData3 = {
      data: {
        complianceReportId: 3,
        renewableFuelTargetSummary: [
          {
            line: 1,
            description: 'renewableFuelTargetSummary',
            format: 'number',
            gasoline: 250
          }
        ],
        lowCarbonFuelTargetSummary: [
          {
            line: 1,
            description: 'lowCarbonFuelTargetSummary',
            format: 'number',
            value: 70
          }
        ],
        nonCompliancePenaltySummary: [
          {
            line: 1,
            description: 'nonCompliancePenaltySummary',
            format: 'number',
            value: 99
          }
        ]
      }
    }

    useGetComplianceReportSummary.mockImplementation((id) => {
      if (id === 1) {
        return reportData1
      }
      if (id === 2) {
        return reportData2
      }
      if (id === 3) {
        return reportData3
      }
      return { data: null }
    })
  })

  it('initializes with default report selections in correct order', () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    // Earliest report should be on the left (report1), most recent on the right (report2)
    expect(report1Select).toHaveTextContent('Supplemental Report 1')
    expect(report2Select).toHaveTextContent('Government Adjustment 2')
  })

  it('ensures column ordering follows chronological order (earliest left, latest right)', () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    expect(report1Select).toHaveTextContent('Supplemental Report 1')
    expect(report2Select).toHaveTextContent('Government Adjustment 2')

    fireEvent.mouseDown(report1Select)
    fireEvent.click(
      screen.getByRole('option', { name: 'Government Adjustment 2' })
    )

    fireEvent.mouseDown(report2Select)
    fireEvent.click(screen.getByRole('option', { name: 'Original Report' }))

    expect(report1Select).toHaveTextContent('Government Adjustment 2')
    expect(report2Select).toHaveTextContent('Original Report')
  })

  it('allows selecting different reports', async () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    // Open first dropdown and select a different option
    fireEvent.mouseDown(report1Select)
    fireEvent.click(screen.getByRole('option', { name: 'Original Report' }))

    // Verify selection was made
    expect(report1Select).toHaveTextContent('Original Report')
    expect(report2Select).toHaveTextContent('Government Adjustment 2')

    // Open second dropdown and select a different option
    fireEvent.mouseDown(report2Select)
    fireEvent.click(
      screen.getByRole('option', { name: 'Supplemental Report 1' })
    )

    // Verify both selections
    expect(report1Select).toHaveTextContent('Original Report')
    expect(report2Select).toHaveTextContent('Supplemental Report 1')
  })

  it('should not allow selecting the same report in both dropdowns', async () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    // Initially Supplemental Report 1 (left) and Government Adjustment 2 (right) are selected

    // Select Original Report in first dropdown
    fireEvent.mouseDown(report1Select)
    fireEvent.click(screen.getByRole('option', { name: 'Original Report' }))

    // Open second dropdown to check options
    fireEvent.mouseDown(report2Select)

    // Original Report should not be an option in second dropdown
    expect(
      screen.queryByRole('option', { name: 'Original Report' })
    ).not.toBeInTheDocument()

    // Government Adjustment 2 and Supplemental Report 1 should be options
    expect(
      screen.getByRole('option', { name: 'Government Adjustment 2' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Supplemental Report 1' })
    ).toBeInTheDocument()
  })

  it('displays data in CompareTable when reports are selected by default', async () => {
    render(<CompareReports />, { wrapper })

    // The component automatically selects the two most recent reports,
    // so we should see data in the tables immediately
    expect(screen.getByText(/renewableFuelTargetSummary/i)).toBeInTheDocument()
    expect(screen.getByText(/lowCarbonFuelTargetSummary/i)).toBeInTheDocument()

    // Data values should be present with default selections
    const value250Elements = screen.getAllByText('250')
    const value70Elements = screen.getAllByText('70')

    expect(value250Elements.length).toBeGreaterThan(0)
    expect(value70Elements.length).toBeGreaterThan(0)
  })

  it('displays correct data in CompareTable after changing report selections', async () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    // Change selections
    fireEvent.mouseDown(report1Select)
    fireEvent.click(screen.getByRole('option', { name: 'Original Report' }))

    fireEvent.mouseDown(report2Select)
    fireEvent.click(
      screen.getByRole('option', { name: 'Supplemental Report 1' })
    )

    // Check if the data rows are rendered correctly after selection
    expect(screen.getByText(/renewableFuelTargetSummary/i)).toBeInTheDocument()
    expect(screen.getByText(/lowCarbonFuelTargetSummary/i)).toBeInTheDocument()

    // Check that values are present after selection
    const value100Elements = screen.getAllByText('100')
    const value250Elements = screen.getAllByText('250')
    const value50Elements = screen.getAllByText('50')
    const value70Elements = screen.getAllByText('70')

    expect(value100Elements.length).toBeGreaterThan(0)
    expect(value250Elements.length).toBeGreaterThan(0)
    expect(value50Elements.length).toBeGreaterThan(0)
    expect(value70Elements.length).toBeGreaterThan(0)
  })
})
