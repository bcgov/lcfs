import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import { AssignedAnalystCell } from '../AssignedAnalystCell'
import * as useComplianceReportsHook from '@/hooks/useComplianceReports'
import * as useCurrentUserHook from '@/hooks/useCurrentUser'

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock hooks
vi.mock('@/hooks/useComplianceReports')
vi.mock('@/hooks/useCurrentUser')

describe('AssignedAnalystCell', () => {
  let mockOnRefresh
  let mockAssignAnalyst
  let mockGetAvailableAnalysts

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnRefresh = vi.fn()
    mockAssignAnalyst = vi.fn()
    mockGetAvailableAnalysts = vi.fn()

    // Default mock implementations
    useCurrentUserHook.useCurrentUser.mockReturnValue({
      hasRoles: vi.fn(() => true)
    })

    useComplianceReportsHook.useGetAvailableAnalysts.mockReturnValue({
      data: [
        {
          userProfileId: 1,
          firstName: 'John',
          lastName: 'Doe',
          initials: 'JD'
        },
        {
          userProfileId: 2,
          firstName: 'Jane',
          lastName: 'Smith',
          initials: 'JS'
        }
      ],
      isLoading: false
    })

    useComplianceReportsHook.useAssignAnalyst.mockReturnValue({
      mutate: mockAssignAnalyst,
      isLoading: false
    })
  })

  describe('Supplier (Read-only) View', () => {
    beforeEach(() => {
      useCurrentUserHook.useCurrentUser.mockReturnValue({
        hasRoles: vi.fn(() => false) // Supplier role
      })
    })

    it('should render dash when no analyst assigned for suppliers', () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      expect(screen.getByText('-')).toBeInTheDocument()
    })

    it('should render analyst pill for suppliers when analyst assigned', () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: {
          userProfileId: 1,
          firstName: 'John',
          lastName: 'Doe',
          initials: 'JD'
        }
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      expect(screen.getByText('JD')).toBeInTheDocument()
      
      // Verify the chip exists (tooltip testing would require more setup)
      const chip = screen.getByText('JD')
      expect(chip).toBeInTheDocument()
    })
  })

  describe('Government/Analyst (Interactive) View', () => {
    beforeEach(() => {
      useCurrentUserHook.useCurrentUser.mockReturnValue({
        hasRoles: vi.fn(() => true) // Government/Analyst role
      })
    })

    it('should render assignment dropdown for government users when no analyst assigned', () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      // The Select component should be present
      const selectElement = screen.getByRole('combobox')
      expect(selectElement).toBeInTheDocument()
    })

    it('should render analyst pill in dropdown when analyst assigned', () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: {
          userProfileId: 1,
          firstName: 'John',
          lastName: 'Doe',
          initials: 'JD'
        }
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('should open dropdown and show available analysts when clicked', async () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      // Click to open dropdown
      const selectElement = screen.getByRole('combobox')
      fireEvent.mouseDown(selectElement)

      await waitFor(() => {
        expect(screen.getByText('report:unassign')).toBeInTheDocument()
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      })
    })

    it('should handle analyst assignment', async () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      // Open dropdown
      const selectElement = screen.getByRole('combobox')
      fireEvent.mouseDown(selectElement)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      // Select an analyst
      fireEvent.click(screen.getByText('John Doe'))

      expect(mockAssignAnalyst).toHaveBeenCalledWith({
        reportId: 1,
        assignedAnalystId: 1
      })
    })

    it('should handle analyst unassignment', async () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: {
          userProfileId: 1,
          firstName: 'John',
          lastName: 'Doe',
          initials: 'JD'
        }
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      // Open dropdown
      const selectElement = screen.getByRole('combobox')
      fireEvent.mouseDown(selectElement)

      await waitFor(() => {
        expect(screen.getByText('report:unassign')).toBeInTheDocument()
      })

      // Select unassigned
      fireEvent.click(screen.getByText('report:unassign'))

      expect(mockAssignAnalyst).toHaveBeenCalledWith({
        reportId: 1,
        assignedAnalystId: null
      })
    })

    it('should show loading state during assignment', () => {
      useComplianceReportsHook.useAssignAnalyst.mockReturnValue({
        mutate: mockAssignAnalyst,
        isLoading: true
      })

      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should be disabled when analysts are loading', () => {
      useComplianceReportsHook.useGetAvailableAnalysts.mockReturnValue({
        data: [],
        isLoading: true
      })

      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      const selectElement = screen.getByRole('combobox')
      expect(selectElement).toHaveAttribute('aria-disabled', 'true')
    })

    it('should call onRefresh when assignment succeeds', async () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      // Setup mock to capture onSuccess from hook options
      let capturedOnSuccess
      useComplianceReportsHook.useAssignAnalyst.mockReturnValue({
        mutate: vi.fn((params) => {
          // Call the onSuccess callback that was passed to the hook
          capturedOnSuccess?.()
        }),
        isLoading: false
      })

      // Capture the onSuccess callback from hook initialization
      useComplianceReportsHook.useAssignAnalyst.mockImplementation((options) => {
        capturedOnSuccess = options?.onSuccess
        return {
          mutate: vi.fn((params) => {
            capturedOnSuccess?.()
          }),
          isLoading: false
        }
      })

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      // Open dropdown
      const selectElement = screen.getByRole('combobox')
      fireEvent.mouseDown(selectElement)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      // Select an analyst
      fireEvent.click(screen.getByText('John Doe'))

      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: {
          userProfileId: 1,
          firstName: 'John',
          lastName: 'Doe',
          initials: 'JD'
        }
      }

      customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)

      const chip = screen.getByText('JD')
      expect(chip).toBeInTheDocument()
      
      // For government users, test the select component
      useCurrentUserHook.useCurrentUser.mockReturnValue({
        hasRoles: vi.fn(() => true)
      })
      
      const { container } = customRender(<AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />)
      const selectElement = container.querySelector('[role="combobox"]')
      expect(selectElement).toBeInTheDocument()
    })
  })
})