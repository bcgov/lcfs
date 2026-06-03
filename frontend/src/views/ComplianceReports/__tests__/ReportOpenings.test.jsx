import React, { forwardRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReportOpenings } from '../ReportOpenings/ReportOpenings'
import { wrapper } from '@/tests/utils/wrapper.jsx'
import {
  useReportOpenings,
  useUpdateReportOpenings
} from '@/hooks/useReportOpenings'

vi.mock('@/hooks/useReportOpenings', () => ({
  useReportOpenings: vi.fn(),
  useUpdateReportOpenings: vi.fn()
}))

vi.mock('@/components/BCAlert', () => ({
  FloatingAlert: forwardRef((props, ref) => (
    <div ref={ref} data-test="floating-alert" {...props} />
  ))
}))

const useReportOpeningsMock = useReportOpenings
const useUpdateReportOpeningsMock = useUpdateReportOpenings

describe('ReportOpenings', () => {
  const mockData = [
    {
      complianceYear: 2019,
      complianceReportingEnabled: false,
      earlyIssuanceEnabled: false,
      createSupplementalEnabled: true
    },
    {
      complianceYear: 2020,
      complianceReportingEnabled: true,
      earlyIssuanceEnabled: false,
      createSupplementalEnabled: false
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useReportOpeningsMock.mockReturnValue({
      data: mockData,
      isLoading: false
    })
    useUpdateReportOpeningsMock.mockReturnValue({
      isPending: false,
      mutate: vi.fn()
    })
  })

  it('renders years from the API and enables save on change', async () => {
    render(<ReportOpenings />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('2019')).toBeInTheDocument()
      expect(screen.getByText('2020')).toBeInTheDocument()
    })

    const saveButton = screen.getByRole('button', { name: /Save/i })

    expect(saveButton).toBeDisabled()

    const complianceToggle2020 = screen.getByLabelText(/compliance reporting availability.*2020/i)
    await userEvent.click(complianceToggle2020)

    expect(saveButton).not.toBeDisabled()
  })

  it('renders a create supplemental checkbox per year and enables save on toggle', async () => {
    render(<ReportOpenings />, { wrapper })

    const supplementalToggle2019 = await screen.findByLabelText(
      /create supplemental report availability.*2019/i
    )
    const supplementalToggle2020 = screen.getByLabelText(
      /create supplemental report availability.*2020/i
    )

    expect(supplementalToggle2019).toBeChecked()
    expect(supplementalToggle2020).not.toBeChecked()

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()

    const saveButton = screen.getByRole('button', { name: /Save/i })
    expect(saveButton).toBeDisabled()

    await userEvent.click(supplementalToggle2020)

    expect(supplementalToggle2020).toBeChecked()
    expect(saveButton).not.toBeDisabled()
  })
})
