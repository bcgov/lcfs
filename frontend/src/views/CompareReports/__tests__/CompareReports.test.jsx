import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useGetComplianceReportSummary,
  useListComplianceReports
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
      data: { organization: { organizationId: 1 } }
    })

    const reportData = [
      {
        compliancePeriod: '2021',
        complianceReportId: 1
      },
      { compliancePeriod: '2022', complianceReportId: 2 }
    ]
    useListComplianceReports.mockReturnValue({
      data: {
        data: {
          reports: reportData
        }
      }
    })

    const reportData1 = {
      data: {
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
      return { data: null }
    })
  })

  it('renders loading state initially', () => {
    useListComplianceReports.mockReturnValue({ data: null })

    render(<CompareReports />, { wrapper })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('allows selecting different reports', async () => {
    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    fireEvent.mouseDown(report1Select)

    fireEvent.click(
      screen.getByRole('option', { name: 'Compliance report 2022' })
    )

    fireEvent.mouseDown(report2Select)
    fireEvent.click(
      screen.getByRole('option', { name: 'Compliance report 2021' })
    )

    expect(report1Select).toHaveTextContent('Compliance report 2022')
    expect(report2Select).toHaveTextContent('Compliance report 2021')
  })

  it('displays correct data in CompareTable', async () => {
    render(<CompareReports />, { wrapper })

    expect(
      screen.getByText(/renewable fuel target summary/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/low carbon fuel target summary/i)
    ).toBeInTheDocument()

    // Check if the data rows are rendered correctly
    expect(screen.getByText(/renewableFuelTargetSummary/i)).toBeInTheDocument()
    expect(screen.getByText(/lowCarbonFuelTargetSummary/i)).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('70')).toBeInTheDocument()
  })
})
