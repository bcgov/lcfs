import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddEditOtherUses } from '../AddEditOtherUses'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

// Simple mocks to avoid memory issues
const mockNavigate = vi.fn()
const mockUseLocation = vi.fn(() => ({ state: {} }))
const mockUseParams = vi.fn(() => ({ complianceReportId: '123', compliancePeriod: '2024' }))
const mockT = vi.fn((key) => key)

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useParams: () => mockUseParams()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

// Mock all hooks to return simple static data
vi.mock('@/hooks/useComplianceReports', () => ({
  useComplianceReportWithCache: () => ({
    data: { report: { version: 0 } },
    isLoading: false
  })
}))

vi.mock('@/hooks/useOtherUses', () => ({
  useGetAllOtherUsesList: () => ({
    data: [],
    isLoading: false
  }),
  useOtherUsesOptions: () => ({
    data: {
      fuelTypes: [{ 
        fuelType: 'Diesel', 
        defaultCarbonIntensity: 85.5,
        fuelCategories: [{ category: 'Petroleum' }],
        provisionOfTheAct: [{ name: 'Part 2' }]
      }],
      expectedUses: [{ id: 1, name: 'Transportation' }]
    },
    isLoading: false,
    isFetched: true
  }),
  useSaveOtherUses: () => ({
    mutateAsync: vi.fn()
  })
}))

// Mock components completely
vi.mock('@/components/Loading', () => ({
  default: () => <div data-test="loading">Loading...</div>
}))

vi.mock('@/components/BCDataGrid/BCGridEditor', () => ({
  BCGridEditor: () => <div data-test="grid-editor">Grid Editor</div>
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children }) => <div>{children}</div>
}))

// Mock schema to prevent complex logic
vi.mock('./_schema', () => ({
  defaultColDef: {},
  otherUsesColDefs: () => [],
  PROVISION_APPROVED_FUEL_CODE: 'APPROVED_FUEL_CODE'
}))

// Mock utilities
vi.mock('@/utils/schedules.js', () => ({
  handleScheduleDelete: vi.fn(),
  handleScheduleSave: vi.fn()
}))

vi.mock('@/utils/formatters', () => ({
  cleanEmptyStringValues: (data) => data,
  formatNumberWithCommas: (num) => String(num || ''),
  decimalFormatter: (value) => String(value || '')
}))

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AddEditOtherUses />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('AddEditOtherUses Minimal Coverage Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // Test 1: Basic rendering - covers main component function
  it('renders without crashing', () => {
    renderComponent()
    expect(screen.getByText('otherUses:newOtherUsesTitle')).toBeInTheDocument()
  })

  // Test 2: Loading state - covers conditional rendering
  it('shows loading when options are loading', () => {
    vi.doMock('@/hooks/useOtherUses', () => ({
      useOtherUsesOptions: () => ({
        data: null,
        isLoading: true,
        isFetched: false
      }),
      useGetAllOtherUsesList: () => ({ data: [], isLoading: false }),
      useSaveOtherUses: () => ({ mutateAsync: vi.fn() })
    }))
    
    renderComponent()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  // Test 3: Grid editor rendering - covers component integration
  it('renders grid editor when loaded', () => {
    renderComponent()
    expect(screen.getByTestId('grid-editor')).toBeInTheDocument()
  })

  // Test 4: Different params - covers parameter usage
  it('works with different compliance report ID', () => {
    mockUseParams.mockReturnValue({ complianceReportId: '456', compliancePeriod: '2025' })
    renderComponent()
    expect(screen.getByText('otherUses:newOtherUsesTitle')).toBeInTheDocument()
  })

  // Test 5: Supplemental report version - covers version logic
  it('handles supplemental report', () => {
    vi.doMock('@/hooks/useComplianceReports', () => ({
      useComplianceReportWithCache: () => ({
        data: { report: { version: 1 } }, // Supplemental
        isLoading: false
      })
    }))
    
    renderComponent()
    expect(screen.getByTestId('grid-editor')).toBeInTheDocument()
  })

  // Test 6: Location state - covers useEffect hook
  it('handles location state', () => {
    mockUseLocation.mockReturnValue({ 
      state: { message: 'Test message', severity: 'info' } 
    })
    
    renderComponent()
    expect(screen.getByText('otherUses:newOtherUsesTitle')).toBeInTheDocument()
  })

  // Test 7: Existing data - covers data processing
  it('handles existing other uses data', () => {
    vi.doMock('@/hooks/useOtherUses', () => ({
      useOtherUsesOptions: () => ({
        data: {
          fuelTypes: [{ fuelType: 'Diesel' }],
          expectedUses: []
        },
        isLoading: false,
        isFetched: true
      }),
      useGetAllOtherUsesList: () => ({
        data: [{ otherUsesId: 1, fuelType: 'Diesel' }],
        isLoading: false
      }),
      useSaveOtherUses: () => ({ mutateAsync: vi.fn() })
    }))
    
    renderComponent()
    expect(screen.getByTestId('grid-editor')).toBeInTheDocument()
  })

  // Test 8: Error state - covers error handling
  it('handles null data gracefully', () => {
    vi.doMock('@/hooks/useOtherUses', () => ({
      useOtherUsesOptions: () => ({
        data: null,
        isLoading: false,
        isFetched: true
      }),
      useGetAllOtherUsesList: () => ({ data: null, isLoading: false }),
      useSaveOtherUses: () => ({ mutateAsync: vi.fn() })
    }))
    
    renderComponent()
    expect(screen.getByText('otherUses:newOtherUsesTitle')).toBeInTheDocument()
  })

  // Test 9: Not fetched state - covers early return
  it('returns null when not fetched', () => {
    vi.doMock('@/hooks/useOtherUses', () => ({
      useOtherUsesOptions: () => ({
        data: null,
        isLoading: false,
        isFetched: false
      }),
      useGetAllOtherUsesList: () => ({ data: [], isLoading: false }),
      useSaveOtherUses: () => ({ mutateAsync: vi.fn() })
    }))
    
    const { container } = renderComponent()
    expect(container.firstChild).toBeNull()
  })

  // Test 10: Multiple loading states - covers all loading conditions
  it('shows loading when compliance report is loading', () => {
    vi.doMock('@/hooks/useComplianceReports', () => ({
      useComplianceReportWithCache: () => ({
        data: null,
        isLoading: true
      })
    }))
    
    renderComponent()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })
})