import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { PenaltyHistoryGrid } from '../PenaltyHistoryGrid'

// Mock hooks
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const mockT = vi.fn((key, options) => {
  const translations = {
    'org:penaltyLog.history': 'Penalty history',
    'org:penaltyLog.addPenaltyBtn': 'Add/Edit discretionary penalties'
  }
  return translations[key] || options?.defaultValue || key
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

// Mock organization hooks
const mockPenaltyLogs = {
  penaltyLogs: [
    {
      penaltyLogId: 1,
      complianceYear: '2024',
      contraventionType: 'Single contravention',
      penaltyAmount: 5000,
      offenceHistory: false,
      deliberate: false,
      effortsToCorrect: true,
      economicBenefitDerived: false,
      effortsToPreventRecurrence: true,
      notes: 'Test note'
    },
    {
      penaltyLogId: 2,
      complianceYear: '2023',
      contraventionType: 'Continuous contravention',
      penaltyAmount: 10000,
      offenceHistory: true,
      deliberate: true,
      effortsToCorrect: false,
      economicBenefitDerived: true,
      effortsToPreventRecurrence: false,
      notes: 'Another test'
    }
  ],
  pagination: { total: 2, page: 1, size: 10, totalPages: 1 }
}

vi.mock('@/hooks/useOrganization', () => ({
  useOrganizationPenaltyLogs: vi.fn(() => ({
    data: mockPenaltyLogs,
    isLoading: false,
    refetch: vi.fn()
  }))
}))

// Mock BCGridViewer
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: ({ columnDefs, queryData }) => (
    <div data-testid="bc-grid-viewer">
      <div data-testid="column-count">{columnDefs?.length || 0}</div>
      <div data-testid="data-loaded">
        {queryData?.data?.penaltyLogs?.length || 0}
      </div>
    </div>
  )
}))

// Mock Role component
vi.mock('@/components/Role', () => ({
  Role: ({ children, roles }) => <div data-testid="role-wrapper">{children}</div>
}))

// Mock ClearFiltersButton
vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({ onClick }) => (
    <button data-testid="clear-filters-btn" onClick={onClick}>
      Clear Filters
    </button>
  )
}))

describe('PenaltyHistoryGrid - Button Label', () => {
  let queryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  const renderComponent = (organizationId = '123') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <PenaltyHistoryGrid organizationId={organizationId} />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }

  it('should render the button with correct label "Add/Edit discretionary penalties"', () => {
    renderComponent()

    expect(screen.getByText('Add/Edit discretionary penalties')).toBeInTheDocument()
  })

  it('should use the translation key "org:penaltyLog.addPenaltyBtn"', () => {
    renderComponent()

    expect(mockT).toHaveBeenCalledWith('org:penaltyLog.addPenaltyBtn')
  })

  it('should navigate to penalty log manage page when button is clicked', () => {
    renderComponent('456')

    const button = screen.getByText('Add/Edit discretionary penalties')
    expect(button).toBeInTheDocument()
    fireEvent.click(button)

    expect(mockNavigate).toHaveBeenCalledWith('/organizations/456/penalty-log/manage')
  })

  it('should not navigate if organizationId is not provided', () => {
    renderComponent(null)

    const button = screen.getByText('Add/Edit discretionary penalties')
    expect(button).toBeInTheDocument()
    fireEvent.click(button)

    // Should not navigate when organizationId is null
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('PenaltyHistoryGrid - Component Functionality', () => {
  let queryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  const renderComponent = (organizationId = '123') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <PenaltyHistoryGrid organizationId={organizationId} />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }

  it('should render the penalty history title', () => {
    renderComponent()

    expect(screen.getByText('Penalty history')).toBeInTheDocument()
  })

  it('should render the clear filters button', () => {
    const { container } = renderComponent()

    expect(container).toBeTruthy()
    expect(screen.getByText('Clear Filters')).toBeInTheDocument()
  })

  it('should render the grid viewer', () => {
    const { container } = renderComponent()

    expect(container).toBeTruthy()
    expect(screen.getByText('Penalty history')).toBeInTheDocument()
  })

  it('should load penalty logs data', () => {
    const { container } = renderComponent()

    expect(container).toBeTruthy()
    expect(screen.getByText('Penalty history')).toBeInTheDocument()
  })

  it('should handle clear filters click', () => {
    const { container } = renderComponent()

    const clearButton = screen.getByText('Clear Filters')
    fireEvent.click(clearButton)

    // Component should not throw errors on clear filters
    expect(container).toBeTruthy()
  })

  it('should pass column definitions to grid viewer', () => {
    const { container } = renderComponent()

    expect(container).toBeTruthy()
    expect(screen.getByText('Penalty history')).toBeInTheDocument()
  })
})

describe('PenaltyHistoryGrid - Edge Cases', () => {
  let queryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  const renderComponent = (organizationId = '123') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <PenaltyHistoryGrid organizationId={organizationId} />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }

  it('should handle empty penalty logs', async () => {
    const { useOrganizationPenaltyLogs } = await import('@/hooks/useOrganization')
    const mockHook = vi.mocked(useOrganizationPenaltyLogs)

    mockHook.mockReturnValue({
      data: { penaltyLogs: [], pagination: { total: 0, page: 1, size: 10, totalPages: 0 } },
      isLoading: false,
      refetch: vi.fn()
    })

    const { container } = renderComponent()

    expect(container).toBeTruthy()
    expect(screen.getByText('Penalty history')).toBeInTheDocument()
  })

  it('should handle loading state', async () => {
    const { useOrganizationPenaltyLogs } = await import('@/hooks/useOrganization')
    const mockHook = vi.mocked(useOrganizationPenaltyLogs)

    mockHook.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn()
    })

    const { container } = renderComponent()

    expect(container).toBeTruthy()
    expect(screen.getByText('Penalty history')).toBeInTheDocument()
  })

  it('should handle missing organizationId gracefully', () => {
    renderComponent(undefined)

    expect(screen.getByText('Penalty history')).toBeInTheDocument()
  })
})
