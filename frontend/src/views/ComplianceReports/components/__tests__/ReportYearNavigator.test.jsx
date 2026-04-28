import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ReportYearNavigator } from '../ReportYearNavigator'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      if (options?.year) {
        return `${key}:${options.year}`
      }
      return key
    }
  })
}))

const renderNavigator = (props) =>
  render(
    <MemoryRouter>
      <ReportYearNavigator {...props} />
    </MemoryRouter>
  )

describe('ReportYearNavigator', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('renders the current compliance period', () => {
    renderNavigator({
      currentCompliancePeriod: '2025',
      previous: null,
      next: null
    })
    expect(screen.getByTestId('report-year-navigator-current')).toHaveTextContent(
      '2025'
    )
  })

  it('disables previous and next arrows when no adjacent reports exist', () => {
    renderNavigator({
      currentCompliancePeriod: '2025',
      previous: null,
      next: null
    })
    expect(screen.getByTestId('report-year-navigator-previous')).toBeDisabled()
    expect(screen.getByTestId('report-year-navigator-next')).toBeDisabled()
  })

  it('enables arrows and navigates to the previous report when clicked', async () => {
    const user = userEvent.setup()
    renderNavigator({
      currentCompliancePeriod: '2025',
      previous: { complianceReportId: 42, compliancePeriod: '2024' },
      next: { complianceReportId: 77, compliancePeriod: '2026' }
    })

    const previousBtn = screen.getByTestId('report-year-navigator-previous')
    const nextBtn = screen.getByTestId('report-year-navigator-next')
    expect(previousBtn).not.toBeDisabled()
    expect(nextBtn).not.toBeDisabled()

    await user.click(previousBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/2024/42')

    await user.click(nextBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/compliance-reporting/2026/77')
  })

  it('disables arrows while loading', () => {
    renderNavigator({
      currentCompliancePeriod: '2025',
      previous: { complianceReportId: 42, compliancePeriod: '2024' },
      next: { complianceReportId: 77, compliancePeriod: '2026' },
      isLoading: true
    })
    expect(screen.getByTestId('report-year-navigator-previous')).toBeDisabled()
    expect(screen.getByTestId('report-year-navigator-next')).toBeDisabled()
  })

  it('disables the previous arrow when the report id is missing', () => {
    renderNavigator({
      currentCompliancePeriod: '2025',
      previous: { compliancePeriod: '2024' },
      next: null
    })
    const previousBtn = screen.getByTestId('report-year-navigator-previous')
    expect(previousBtn).toBeDisabled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
