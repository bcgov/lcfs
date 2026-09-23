import React from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityLinksList } from '../ActivityLinksList'
import { test } from '@/tests/utils/fixtures'
import { useNavigate, useParams } from 'react-router-dom'
import { useApiService } from '@/services/useApiService'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { COMPLIANCE_REPORT_STATUSES } from '@/constants/statuses'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: vi.fn()
  }
})

vi.mock('@/services/useApiService')
vi.mock('@/hooks/useCurrentUser')
vi.mock('@/utils/dateQuarterUtils', () => ({
  getQuarterDateRange: (quarter, year) => {
    const ranges = {
      Q1: { from: `${year}-01-01`, to: `${year}-03-31` },
      Q2: { from: `${year}-01-01`, to: `${year}-06-30` },
      Q3: { from: `${year}-01-01`, to: `${year}-09-30` },
      Q4: { from: `${year}-01-01`, to: `${year}-12-31` }
    }
    return ranges[quarter] || { from: `${year}-01-01`, to: `${year}-12-31` }
  }
}))
vi.mock('@/utils/formatters', () => ({
  dateToLongString: (date) => {
    const d = new Date(date)
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    }
    return new Intl.DateTimeFormat('en-US', options).format(d)
  }
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@/components/Documents/DocumentUploadDialog.jsx', () => ({
  default: ({ open, close, onUploadSuccess, parentID, parentType }) => (
    <div data-test="document-upload-dialog">
      {open && (
        <>
          <div>Upload Dialog Open</div>
          <button onClick={close}>Close</button>
          <button onClick={() => onUploadSuccess()}>Upload Success</button>
          <div>Parent ID: {parentID}</div>
          <div>Parent Type: {parentType}</div>
        </>
      )}
    </div>
  )
}))

describe('ActivityLinksList', () => {
  let mockNavigate
  let mockDownload

  beforeEach(() => {
    vi.clearAllMocks()

    mockNavigate = vi.fn()
    mockDownload = vi.fn().mockResolvedValue()

    useNavigate.mockReturnValue(mockNavigate)
    useParams.mockReturnValue({
      compliancePeriod: '2025',
      complianceReportId: '123'
    })
    useApiService.mockReturnValue({
      download: mockDownload
    })
    useCurrentUser.mockReturnValue({
      data: {
        organization: { name: 'Test Org' }
      }
    })
  })

  describe('Component Rendering', () => {
    test('renders component with all required elements', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.getByText((content, element) => {
          return element?.textContent === 'report:activityLinksList:'
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText((content, element) => {
          return element?.textContent === 'report:activitySecondList:'
        })
      ).toBeInTheDocument()
      expect(screen.getByTestId('download-report')).toBeInTheDocument()
    })

    test('renders without quarterly text for annual reports', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(screen.queryByText(/Did Test Org engage/)).not.toBeInTheDocument()
    })

    test('renders quarterly text for quarterly reports', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={true}
          reportQuarter={2}
        />,
        [query, theme, localization, router]
      )
      const expectedText = screen.getByText((content, element) => {
        const hasText = (node) =>
          node.textContent ===
          'Did Test Org engage in any of the following activities between January 1, 2025 and June 30, 2025?'
        const nodeHasText = hasText(element)
        const childrenDontHaveText = Array.from(element.children).every(
          (child) => !hasText(child)
        )
        return nodeHasText && childrenDontHaveText
      })
      expect(expectedText).toBeInTheDocument()
    })
  })

  describe('Annual Report Activities', () => {
    test('renders all activity links for annual reports', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.notionalTransfers')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.fuelsOtherUse')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.exportFuels')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.allocationAgreements')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.uploadDocuments')
      ).toBeInTheDocument()
    })
  })

  describe('Export fuels link visibility by compliance year', () => {
    test('shows export fuels link when compliance period is 2024 or later', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useParams.mockReturnValue({
        compliancePeriod: '2024',
        complianceReportId: '123'
      })
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.getByText('report:activityLists.exportFuels')
      ).toBeInTheDocument()
    })

    test('hides export fuels link when compliance period is before 2024', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useParams.mockReturnValue({
        compliancePeriod: '2023',
        complianceReportId: '123'
      })
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.queryByText('report:activityLists.exportFuels')
      ).not.toBeInTheDocument()
    })

    test('hides export fuels link for 2022 compliance period', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useParams.mockReturnValue({
        compliancePeriod: '2022',
        complianceReportId: '456'
      })
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.queryByText('report:activityLists.exportFuels')
      ).not.toBeInTheDocument()
    })
  })

  describe('FSE link visibility by compliance year', () => {
    test('shows FSE link when compliance period is 2024 or later', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useParams.mockReturnValue({
        compliancePeriod: '2024',
        complianceReportId: '123'
      })
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.getByText('report:activityLists.finalSupplyEquipment')
      ).toBeInTheDocument()
    })

    test('hides FSE link when compliance period is before 2024', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useParams.mockReturnValue({
        compliancePeriod: '2023',
        complianceReportId: '123'
      })
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.queryByText('report:activityLists.finalSupplyEquipment')
      ).not.toBeInTheDocument()
    })

    test('hides FSE link for 2022 compliance period', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useParams.mockReturnValue({
        compliancePeriod: '2022',
        complianceReportId: '456'
      })
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.queryByText('report:activityLists.finalSupplyEquipment')
      ).not.toBeInTheDocument()
    })
  })

  describe('Quarterly Report Activities (Q1-Q3)', () => {
    test('renders filtered links for Q1 (quarterly enabled only)', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={true}
          reportQuarter={1}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.notionalTransfers')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('report:activityLists.fuelsOtherUse')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('report:activityLists.exportFuels')
      ).not.toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.allocationAgreements')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.uploadDocuments')
      ).toBeInTheDocument()
    })

    test('renders filtered links for Q2', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={true}
          reportQuarter={2}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.notionalTransfers')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('report:activityLists.fuelsOtherUse')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('report:activityLists.exportFuels')
      ).not.toBeInTheDocument()
    })

    test('renders filtered links for Q3', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={true}
          reportQuarter={3}
        />,
        [query, theme, localization, router]
      )
      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
      expect(
        screen.getByText('report:activityLists.notionalTransfers')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('report:activityLists.fuelsOtherUse')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('report:activityLists.exportFuels')
      ).not.toBeInTheDocument()
    })
  })

  describe('Navigation Functionality', () => {
    test('navigates to supply of fuel when clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])
      await user.click(screen.getByText('report:activityLists.supplyOfFuel'))
      expect(mockNavigate).toHaveBeenCalledWith(
        '/compliance-reporting/2025/123/supply-of-fuel'
      )
    })

    test('navigates to notional transfers when clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])
      await user.click(
        screen.getByText('report:activityLists.notionalTransfers')
      )
      expect(mockNavigate).toHaveBeenCalledWith(
        '/compliance-reporting/2025/123/notional-transfers'
      )
    })

    test('navigates to other use fuels when clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])
      await user.click(screen.getByText('report:activityLists.fuelsOtherUse'))
      expect(mockNavigate).toHaveBeenCalledWith(
        '/compliance-reporting/2025/123/fuels-other-use'
      )
    })

    test('navigates to fuel exports when clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])
      await user.click(screen.getByText('report:activityLists.exportFuels'))
      expect(mockNavigate).toHaveBeenCalledWith(
        '/compliance-reporting/2025/123/fuel-exports'
      )
    })

    test('navigates to allocation agreements when clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])
      await user.click(
        screen.getByText('report:activityLists.allocationAgreements')
      )
      expect(mockNavigate).toHaveBeenCalledWith(
        '/compliance-reporting/2025/123/allocation-agreements'
      )
    })
  })

  describe('Download Functionality', () => {
    test('triggers report download when download button is clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])
      await user.click(screen.getByTestId('download-report'))
      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalledWith({
          url: '/reports/123/export'
        })
      })
    })

    test('shows loading state during download', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      let resolveDownload
      const downloadPromise = new Promise((resolve) => {
        resolveDownload = resolve
      })
      mockDownload.mockReturnValue(downloadPromise)

      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      const downloadButton = screen.getByTestId('download-report')
      await user.click(downloadButton)

      await waitFor(() => {
        expect(downloadButton).toBeDisabled()
      })

      resolveDownload()
      await waitFor(() => {
        expect(downloadButton).not.toBeDisabled()
      })
    })

    test('triggers download when link text is clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])
      await user.click(screen.getByText('report:activityLists.downloadExcel'))
      await waitFor(() => {
        expect(mockDownload).toHaveBeenCalledWith({
          url: '/reports/123/export'
        })
      })
    })
  })

  describe('Document Upload Functionality', () => {
    test('opens document upload dialog when clicked', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      await user.click(screen.getByText('report:activityLists.uploadDocuments'))

      expect(screen.getByText('Upload Dialog Open')).toBeInTheDocument()
      expect(screen.getByText('Parent ID: 123')).toBeInTheDocument()
      expect(
        screen.getByText('Parent Type: compliance_report')
      ).toBeInTheDocument()
    })

    test('closes document upload dialog', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      await user.click(screen.getByText('report:activityLists.uploadDocuments'))
      expect(screen.getByText('Upload Dialog Open')).toBeInTheDocument()

      await user.click(screen.getByText('Close'))
      expect(screen.queryByText('Upload Dialog Open')).not.toBeInTheDocument()
    })

    test('handles upload success callback', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(<ActivityLinksList currentStatus="Draft" />, [
        query,
        theme,
        localization,
        router
      ])

      await user.click(screen.getByText('report:activityLists.uploadDocuments'))
      await user.click(screen.getByText('Upload Success'))

      // Should not crash - callback is empty but valid
      expect(screen.getByText('Upload Dialog Open')).toBeInTheDocument()
    })
  })

  describe('Status-based Rendering', () => {
    test('shows download section when status is Draft', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(screen.getByTestId('download-report')).toBeInTheDocument()
      expect(screen.getByText('report:downloadExcel')).toBeInTheDocument()
    })

    test('hides download section when status is not Draft', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Submitted"
          isQuarterlyReport={false}
          reportQuarter={null}
        />,
        [query, theme, localization, router]
      )
      expect(screen.queryByTestId('download-report')).not.toBeInTheDocument()
      expect(screen.queryByText('report:downloadExcel')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    test('handles missing currentUser gracefully', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useCurrentUser.mockReturnValue({ data: null })

      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={true}
          reportQuarter={2}
        />,
        [query, theme, localization, router]
      )

      // Should still render without organization name
      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
    })

    test('handles undefined reportQuarter for quarterly reports', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={true}
          reportQuarter={undefined}
        />,
        [query, theme, localization, router]
      )

      // Should show all activities when reportQuarter is undefined
      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('report:activityLists.fuelsOtherUse')
      ).not.toBeInTheDocument()
    })

    test('handles missing currentUser organization', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      useCurrentUser.mockReturnValue({
        data: { organization: null }
      })

      render(
        <ActivityLinksList
          currentStatus="Draft"
          isQuarterlyReport={true}
          reportQuarter={2}
        />,
        [query, theme, localization, router]
      )

      expect(
        screen.getByText('report:activityLists.supplyOfFuel')
      ).toBeInTheDocument()
    })
  })
})
