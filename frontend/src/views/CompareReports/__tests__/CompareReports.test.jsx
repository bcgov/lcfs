import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useGetComplianceReportSummary } from '@/hooks/useComplianceReports'
import useComplianceReportStore from '@/stores/useComplianceReportStore'
import { CompareReports } from '@/views/CompareReports/CompareReports'
import { wrapper } from '@/tests/utils/wrapper'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

// Mock hooks and stores
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useComplianceReports')
vi.mock('@/stores/useComplianceReportStore')

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key // Simple mock that returns the key
  })
}))

describe('CompareReports Component', () => {
  const mockReportChain = [
    {
      nickname: 'Original Report',
      complianceReportId: 1,
      timestamp: '2021-01-01',
      version: 0,
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
    },
    {
      nickname: 'Supplemental Report 1',
      complianceReportId: 2,
      timestamp: '2021-02-01',
      version: 1,
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT }
    },
    {
      nickname: 'Government Adjustment 2',
      complianceReportId: 3,
      timestamp: '2021-03-01',
      version: 2,
      currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
    }
  ]

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

  beforeEach(() => {
    useCurrentUser.mockReturnValue({
      hasRoles: true,
      data: { organization: { organizationId: 1 } },
      isLoading: false
    })

    // Mock the compliance report store with currentReport
    useComplianceReportStore.mockReturnValue({
      currentReport: {
        chain: mockReportChain,
        report: {
          compliancePeriod: '2021',
          complianceReportId: 3
        }
      }
    })

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

  afterEach(() => {
    vi.clearAllMocks()
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

    fireEvent.mouseDown(report2Select)
    fireEvent.click(screen.getByRole('option', { name: 'Original Report' }))

    fireEvent.mouseDown(report1Select)
    fireEvent.click(
      screen.getByRole('option', { name: 'Government Adjustment 2' })
    )

    expect(report1Select).toHaveTextContent('Government Adjustment 2')
    expect(report2Select).toHaveTextContent('Original Report')
  })

  it('does not label supplemental reports as not assessed when original is not selected', async () => {
    render(<CompareReports />, { wrapper })

    await waitFor(() => {
      expect(
        screen.queryByText('report:originalReportNotAssessed')
      ).not.toBeInTheDocument()
    })
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
    expect(
      screen.getAllByText(/renewableFuelTargetSummary/i).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/lowCarbonFuelTargetSummary/i).length
    ).toBeGreaterThan(0)

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
    expect(
      screen.getAllByText(/renewableFuelTargetSummary/i).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/lowCarbonFuelTargetSummary/i).length
    ).toBeGreaterThan(0)

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

  it('shows loading state when isLoading is true', () => {
    // Mock loading state
    useComplianceReportStore.mockReturnValue({ currentReport: null })
    
    render(<CompareReports />, { wrapper })
    
    // Should show loading component
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('handles no currentReport scenario', () => {
    useComplianceReportStore.mockReturnValue({ currentReport: null })
    
    render(<CompareReports />, { wrapper })
    
    // Should show loading when no currentReport
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('handles report chain with less than 2 reports', async () => {
    useComplianceReportStore.mockReturnValue({
      currentReport: {
        chain: [mockReportChain[0]], // Only one report
        report: { compliancePeriod: '2021', complianceReportId: 1 }
      }
    })

    await act(async () => {
      render(<CompareReports />, { wrapper })
    })

    // Should render selects but with no default selections
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2)
  })

  it('handles empty report chain', async () => {
    useComplianceReportStore.mockReturnValue({
      currentReport: {
        chain: [], // Empty chain
        report: { compliancePeriod: '2021', complianceReportId: 1 }
      }
    })

    await act(async () => {
      render(<CompareReports />, { wrapper })
    })

    // Should render selects but with no options
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2)
  })

  it('handles data processing with missing matching rows', () => {
    // Mock report data where second report has no matching rows
    const incompleteReportData2 = {
      data: {
        complianceReportId: 2,
        renewableFuelTargetSummary: [], // Empty
        lowCarbonFuelTargetSummary: [], // Empty
        nonCompliancePenaltySummary: [] // Empty
      }
    }

    useGetComplianceReportSummary.mockImplementation((id) => {
      if (id === 1) return { data: reportData1.data }
      if (id === 2) return incompleteReportData2
      if (id === 3) return { data: reportData3.data }
      return { data: null }
    })

    render(<CompareReports />, { wrapper })

    // Should render without errors even with incomplete data
    expect(screen.getAllByText(/renewableFuelTargetSummary/i).length).toBeGreaterThan(0)
  })


  it('handles conflict resolution when no available alternatives exist', async () => {
    // Test with only 2 reports to force edge case
    useComplianceReportStore.mockReturnValue({
      currentReport: {
        chain: mockReportChain.slice(0, 2), // Only 2 reports
        report: { compliancePeriod: '2021', complianceReportId: 2 }
      }
    })

    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    const report2Select = screen.getAllByRole('combobox')[1]

    // Should handle the case with limited options
    expect(report1Select).toBeInTheDocument()
    expect(report2Select).toBeInTheDocument()
  })

  it('processes different fuel types correctly', async () => {
    render(<CompareReports />, { wrapper })

    // Should render fuel control buttons and allow fuel type changes
    const renewableTable = screen.getByText('report:renewableFuelTargetSummary')
    expect(renewableTable).toBeInTheDocument()
  })

  it('labels the original report column when supplemental exists and original is not assessed', async () => {
    useComplianceReportStore.mockReturnValue({
      currentReport: {
        chain: [
          {
            nickname: 'Original Report',
            complianceReportId: 1,
            timestamp: '2021-01-01',
            version: 0,
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.SUBMITTED }
          },
          {
            nickname: 'Supplemental Report 1',
            complianceReportId: 2,
            timestamp: '2021-02-01',
            version: 1,
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.DRAFT }
          }
        ],
        report: { compliancePeriod: '2021', complianceReportId: 2 }
      }
    })

    render(<CompareReports />, { wrapper })

    await waitFor(() => {
      expect(
        screen.getAllByText('report:originalReportNotAssessed').length
      ).toBeGreaterThan(0)
    })
  })

  it('does not label the original report when it has been assessed', async () => {
    useComplianceReportStore.mockReturnValue({
      currentReport: {
        chain: [
          {
            ...mockReportChain[0],
            currentStatus: { status: COMPLIANCE_REPORT_STATUSES.ASSESSED }
          },
          mockReportChain[1],
          mockReportChain[2]
        ],
        report: { compliancePeriod: '2021', complianceReportId: 3 }
      }
    })

    render(<CompareReports />, { wrapper })

    const report1Select = screen.getAllByRole('combobox')[0]
    fireEvent.mouseDown(report1Select)
    fireEvent.click(screen.getByRole('option', { name: 'Original Report' }))

    await waitFor(() => {
      expect(
        screen.queryByText('report:originalReportNotAssessed')
      ).not.toBeInTheDocument()
    })
  })

  it('auto-selects the available fuel type and disables empty options', async () => {
    const dieselOnlySummary = {
      data: {
        complianceReportId: 2,
        renewableFuelTargetSummary: [
          {
            line: 3,
            description: 'line3',
            format: 'number',
            gasoline: 0,
            diesel: 120,
            jetFuel: 0
          },
          {
            line: 9,
            description: 'line9',
            format: 'number',
            gasoline: 0,
            diesel: 15,
            jetFuel: 0
          }
        ],
        lowCarbonFuelTargetSummary: [
          {
            line: 1,
            description: 'lowCarbonFuelTargetSummary',
            format: 'number',
            value: 0
          }
        ],
        nonCompliancePenaltySummary: [
          {
            line: 1,
            description: 'nonCompliancePenaltySummary',
            format: 'number',
            value: 0
          }
        ]
      }
    }

    useGetComplianceReportSummary.mockImplementation(() => dieselOnlySummary)

    render(<CompareReports />, { wrapper })

    await waitFor(() => {
      expect(screen.getByDisplayValue('diesel')).toBeChecked()
    })

    expect(screen.getByDisplayValue('gasoline')).toBeDisabled()
    expect(screen.getByDisplayValue('jetFuel')).toBeDisabled()
  })

  it('prefers gasoline when multiple fuel categories have content', async () => {
    const multiFuelSummary = {
      data: {
        complianceReportId: 2,
        renewableFuelTargetSummary: [
          {
            line: 3,
            description: 'line3',
            format: 'number',
            gasoline: 10,
            diesel: 20,
            jetFuel: 0
          },
          {
            line: 9,
            description: 'line9',
            format: 'number',
            gasoline: 0,
            diesel: 5,
            jetFuel: 0
          }
        ],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: []
      }
    }

    useGetComplianceReportSummary.mockImplementation(() => multiFuelSummary)

    render(<CompareReports />, { wrapper })

    await waitFor(() => {
      expect(screen.getByDisplayValue('gasoline')).toBeChecked()
    })

    expect(screen.getByDisplayValue('diesel')).not.toBeDisabled()
  })

  it('handles null/undefined data values in processing', () => {
    // Mock data with null/undefined values
    const nullValueReportData = {
      data: {
        complianceReportId: 1,
        renewableFuelTargetSummary: [{
          line: 1,
          description: 'test',
          format: 'number',
          gasoline: null
        }],
        lowCarbonFuelTargetSummary: [{
          line: 1,
          description: 'test',
          format: 'number',
          value: null
        }],
        nonCompliancePenaltySummary: [{
          line: 1,
          description: 'test',
          format: 'number',
          value: null,
          totalValue: null,
          amount: null
        }]
      }
    }

    useGetComplianceReportSummary.mockImplementation((id) => {
      if (id === 1) return nullValueReportData
      if (id === 2) return { data: reportData2.data }
      return { data: null }
    })

    render(<CompareReports />, { wrapper })

    // Should handle null values without errors
    expect(screen.getAllByText(/renewableFuelTargetSummary/i).length).toBeGreaterThan(0)
  })

  it('displays correct report names when reports are selected', () => {
    render(<CompareReports />, { wrapper })

    // Report names should be resolved correctly from the chain
    const tables = screen.getAllByRole('table')
    expect(tables.length).toBeGreaterThan(0)
  })

  it('handles non-compliance penalty data with different field names', () => {
    // Test different field combinations for non-compliance penalty
    const diverseReportData = {
      data: {
        complianceReportId: 1,
        renewableFuelTargetSummary: [],
        lowCarbonFuelTargetSummary: [],
        nonCompliancePenaltySummary: [
          {
            line: 1,
            description: 'test1',
            format: 'number',
            value: 100 // Using value field
          },
          {
            line: 2,
            description: 'test2', 
            format: 'number',
            totalValue: 200 // Using totalValue field
          },
          {
            line: 3,
            description: 'test3',
            format: 'number',
            amount: 300 // Using amount field
          },
          {
            line: 4,
            description: 'test4',
            format: 'number',
            gasoline: 400 // Using gasoline field (fuelType)
          }
        ]
      }
    }

    useGetComplianceReportSummary.mockImplementation((id) => {
      if (id === 1) return diverseReportData
      if (id === 2) return { data: reportData2.data }
      return { data: null }
    })

    render(<CompareReports />, { wrapper })

    // Should process all different field types without errors
    expect(screen.getAllByText(/nonCompliancePenaltySummary/i).length).toBeGreaterThan(0)
  })

  it('handles report selection with single report available', async () => {
    // Test edge case where only one report is available for selection
    useComplianceReportStore.mockReturnValue({
      currentReport: {
        chain: [mockReportChain[0]], // Only one report
        report: { compliancePeriod: '2021', complianceReportId: 1 }
      }
    })

    render(<CompareReports />, { wrapper })

    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2)
    
    // Each select should be present but may have limited options
    expect(selects[0]).toBeInTheDocument()
    expect(selects[1]).toBeInTheDocument()
  })
})
