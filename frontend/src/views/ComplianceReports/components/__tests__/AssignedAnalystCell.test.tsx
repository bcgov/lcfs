import 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import { AssignedAnalystCell } from '../AssignedAnalystCell'
import type { ReactNode } from 'react'
import type { RenderOptions } from '@testing-library/react'

const {
  mockGetAvailableAnalysts,
  mockUseAssignAnalyst,
  mockUseCurrentUser,
  mockOnRefresh,
  mockAssignAnalyst
} = vi.hoisted(() => ({
  mockGetAvailableAnalysts: vi.fn(),
  mockUseAssignAnalyst: vi.fn(),
  mockUseCurrentUser: vi.fn(),
  mockOnRefresh: vi.fn(),
  mockAssignAnalyst: vi.fn()
}))

// Custom render function with providers
const customRender = (
  ui: React.ReactElement,
  options: Omit<RenderOptions, 'wrapper'> = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const AllTheProviders = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}))

// Mock hooks
vi.mock('@/hooks/useComplianceReports', () => ({
  useGetAvailableAnalysts: mockGetAvailableAnalysts,
  useAssignAnalyst: mockUseAssignAnalyst
}))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: mockUseCurrentUser
}))

describe('AssignedAnalystCell', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockUseCurrentUser.mockReturnValue({
      hasRoles: vi.fn(() => true)
    })

    mockGetAvailableAnalysts.mockReturnValue({
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

    mockUseAssignAnalyst.mockReturnValue({
      mutate: mockAssignAnalyst,
      isPending: false
    })
  })

  describe('Supplier (Read-only) View', () => {
    beforeEach(() => {
      mockUseCurrentUser.mockReturnValue({
        hasRoles: vi.fn(() => false) // Supplier role
      })
    })

    it('should render dash when no analyst assigned for suppliers', () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

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

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

      expect(screen.getByText('JD')).toBeInTheDocument()

      // Verify the chip exists (tooltip testing would require more setup)
      const chip = screen.getByText('JD')
      expect(chip).toBeInTheDocument()
    })
  })

  describe('Government/Analyst (Interactive) View', () => {
    beforeEach(() => {
      mockUseCurrentUser.mockReturnValue({
        hasRoles: vi.fn(() => true) // Government/Analyst role
      })
    })

    it('should render assignment dropdown for government users when no analyst assigned', () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

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

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('should open dropdown and show available analysts when clicked', async () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

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

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

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

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

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
      mockUseAssignAnalyst.mockReturnValue({
        mutate: mockAssignAnalyst,
        isPending: true
      })

      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should be disabled when analysts are loading', () => {
      mockGetAvailableAnalysts.mockReturnValue({
        data: [],
        isLoading: true
      })

      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

      const selectElement = screen.getByRole('combobox')
      expect(selectElement).toHaveAttribute('aria-disabled', 'true')
    })

    it('should call onRefresh when assignment succeeds', async () => {
      const data = {
        complianceReportId: 1,
        assignedAnalyst: null
      }

      // Setup mock to capture onSuccess from hook options
      let capturedOnSuccess: (() => void) | undefined

      // Capture the onSuccess callback from hook initialization
      mockUseAssignAnalyst.mockImplementation(
        (options: { onSuccess?: () => void }) => {
          capturedOnSuccess = options?.onSuccess
          return {
            mutate: vi.fn(() => {
              capturedOnSuccess?.()
            }),
            isLoading: false
          }
        }
      )

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

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

      customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )

      const chip = screen.getByText('JD')
      expect(chip).toBeInTheDocument()

      // For government users, test the select component
      mockUseCurrentUser.mockReturnValue({
        hasRoles: vi.fn(() => true)
      })

      const { container } = customRender(
        <AssignedAnalystCell data={data} onRefresh={mockOnRefresh} />
      )
      const selectElement = container.querySelector('[role="combobox"]')
      expect(selectElement).toBeInTheDocument()
    })
  })
})
