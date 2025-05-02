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
          { nickname: 'Original Report', complianceReportId: 1 },
          {
            nickname: 'Supplemental Report 1',
            complianceReportId: 2
          },
          {
            nickname: 'Government Adjustment 2',
            complianceReportId: 3
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

  it('starts with empty dropdowns', () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    // Initial state should be empty
    expect(report1Select).not.toHaveTextContent('Original Report')
    expect(report1Select).not.toHaveTextContent('Supplemental Report 1')
    expect(report1Select).not.toHaveTextContent('Government Adjustment 2')

    expect(report2Select).not.toHaveTextContent('Original Report')
    expect(report2Select).not.toHaveTextContent('Supplemental Report 1')
    expect(report2Select).not.toHaveTextContent('Government Adjustment 2')
  })

  it('allows selecting different reports', async () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    // Open first dropdown and select an option
    fireEvent.mouseDown(report1Select)
    fireEvent.click(
      screen.getByRole('option', { name: 'Government Adjustment 2' })
    )

    // Verify first selection was made
    expect(report1Select).toHaveTextContent('Government Adjustment 2')

    // Open second dropdown and select an option
    fireEvent.mouseDown(report2Select)
    fireEvent.click(screen.getByRole('option', { name: 'Original Report' }))

    // Verify both selections
    expect(report1Select).toHaveTextContent('Government Adjustment 2')
    expect(report2Select).toHaveTextContent('Original Report')
  })

  it('should not allow selecting the same report in both dropdowns', async () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    // Select Government Adjustment 2 in first dropdown
    fireEvent.mouseDown(report1Select)
    fireEvent.click(
      screen.getByRole('option', { name: 'Government Adjustment 2' })
    )

    // Open first dropdown again to check options
    fireEvent.mouseDown(report1Select)

    // All options except the one selected in second dropdown should be available
    expect(
      screen.getByRole('option', { name: 'Original Report' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Supplemental Report 1' })
    ).toBeInTheDocument()

    // Select Original Report in second dropdown
    fireEvent.mouseDown(report2Select)
    fireEvent.click(screen.getByRole('option', { name: 'Original Report' }))

    // Open second dropdown again to check options
    fireEvent.mouseDown(report2Select)

    // Government Adjustment 2 should not be an option in second dropdown
    expect(
      screen.queryByRole('option', { name: 'Government Adjustment 2' })
    ).not.toBeInTheDocument()

    // Supplemental Report 1 should be an option
    expect(
      screen.getByRole('option', { name: 'Supplemental Report 1' })
    ).toBeInTheDocument()
  })

  it('displays no data in CompareTable when no reports are selected', async () => {
    render(<CompareReports />, { wrapper })

    // Initially, the tables should be empty as no reports are selected
    expect(
      screen.getByText(/renewable fuel target summary/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/low carbon fuel target summary/i)
    ).toBeInTheDocument()

    // The specific data values should not be present initially
    expect(screen.queryByText('100')).not.toBeInTheDocument()
    expect(screen.queryByText('250')).not.toBeInTheDocument()
    expect(screen.queryByText('50')).not.toBeInTheDocument()
    expect(screen.queryByText('70')).not.toBeInTheDocument()
  })

  it('displays correct data in CompareTable after selecting reports', async () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    // Select reports
    fireEvent.mouseDown(report1Select)
    fireEvent.click(screen.getByRole('option', { name: 'Original Report' }))

    fireEvent.mouseDown(report2Select)
    fireEvent.click(
      screen.getByRole('option', { name: 'Supplemental Report 1' })
    )

    // Check if the data rows are rendered correctly after selection
    expect(screen.getByText(/renewableFuelTargetSummary/i)).toBeInTheDocument()
    expect(screen.getByText(/lowCarbonFuelTargetSummary/i)).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
  })
})
