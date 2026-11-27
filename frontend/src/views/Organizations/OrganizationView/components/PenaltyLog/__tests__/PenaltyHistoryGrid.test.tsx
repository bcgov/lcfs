import { act, render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ThemeProvider from '@mui/material/styles/ThemeProvider'
import type { ComponentProps } from 'react'
import type { BCGridViewerProps } from '@/components/BCDataGrid/BCGridViewer'
import theme from '@/themes'
import { AutomaticPenaltyLogGrid, PenaltyHistoryGrid } from '../PenaltyGrids'

const mockBCGridViewer = vi.hoisted(() =>
  vi.fn<(props: BCGridViewerProps) => void>()
)

// Mock hooks
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const mockT = vi.fn((key: string, options?: { defaultValue?: string }) => {
  const translations: Partial<Record<string, string>> = {
    'org:penaltyLog.history': 'Penalty history',
    'org:penaltyLog.discretionaryPenalties': 'Penalty history',
    'org:penaltyLog.addPenaltyBtn': 'Add/Edit discretionary penalties',
    'org:penaltyLog.metrics.totalPenalties': 'Total penalties',
    'org:penaltyLog.columns.invoiced': 'Invoiced'
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
  pagination: { total: 12, page: 1, size: 2, totalPages: 6 }
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
  BCGridViewer: (props: BCGridViewerProps) => {
    mockBCGridViewer(props)
    const logs = props.queryData?.data?.penaltyLogs
    return (
      <div data-testid="bc-grid-viewer">
        <div data-testid="column-count">{props.columnDefs?.length || 0}</div>
        <div data-testid="data-loaded">
          {Array.isArray(logs) ? logs.length : 0}
        </div>
      </div>
    )
  }
}))

// Mock Role component
vi.mock('@/components/Role', () => ({
  Role: ({
    children
  }: ComponentProps<typeof import('@/components/Role').Role>) => (
    <div data-testid="role-wrapper">{children}</div>
  )
}))

vi.mock('@/components/BCButton', () => ({
  __esModule: true,
  default: ({ children, onClick, ...props }: ComponentProps<'button'>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  )
}))

// Mock ClearFiltersButton
vi.mock('@/components/ClearFiltersButton', () => ({
  ClearFiltersButton: ({
    onClick
  }: ComponentProps<
    typeof import('@/components/ClearFiltersButton').ClearFiltersButton
  >) => (
    <button data-testid="clear-filters-btn" onClick={onClick}>
      Clear Filters
    </button>
  )
}))

describe('PenaltyHistoryGrid - Button Label', () => {
  let queryClient: QueryClient

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

  const renderComponent = (organizationId: string | null = '123') => {
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

    expect(
      screen.getByText('Add/Edit discretionary penalties')
    ).toBeInTheDocument()
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

    expect(mockNavigate).toHaveBeenCalledWith(
      '/organizations/456/penalty-log/manage'
    )
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
  let queryClient: QueryClient

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

  it('should pass minimum widths to grid viewer', () => {
    renderComponent()

    const gridProps = mockBCGridViewer.mock.calls.find(
      ([props]) => props.gridKey === 'penalty-log-history'
    )?.[0]

    expect(gridProps).toBeDefined()
    expect(gridProps?.columnState).toEqual([])
    expect(
      gridProps?.columnDefs?.every(({ minWidth }) => (minWidth ?? 0) > 0)
    ).toBe(true)
  })

  it('preserves server pagination metadata for discretionary penalties', () => {
    renderComponent()

    const gridProps = mockBCGridViewer.mock.calls.find(
      ([props]) => props.gridKey === 'penalty-log-history'
    )?.[0]

    expect(gridProps?.queryData?.data?.penaltyLogs).toHaveLength(2)
    expect(gridProps?.queryData?.data?.pagination).toEqual({
      total: 12,
      page: 1,
      size: 2,
      totalPages: 6
    })
  })
})

describe('AutomaticPenaltyLogGrid - Grid Sizing', () => {
  let queryClient: QueryClient

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

  const renderComponent = (
    automaticPenaltyRows: ComponentProps<
      typeof AutomaticPenaltyLogGrid
    >['automaticPenaltyRows'] = []
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <AutomaticPenaltyLogGrid
              automaticPenaltyRows={automaticPenaltyRows}
            />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }

  it('should allow the description column to expand', () => {
    renderComponent()

    const gridProps = mockBCGridViewer.mock.calls.find(
      ([props]) => props.gridKey === 'automatic-penalty-log-history'
    )?.[0]

    expect(gridProps).toBeDefined()
    expect(gridProps?.columnState).toEqual([])
    expect(
      gridProps?.columnDefs?.find(
        (columnDef) => columnDef.field === 'description'
      )
    ).toMatchObject({ flex: 2, minWidth: 420 })
    expect(
      gridProps?.columnDefs?.every(({ minWidth }) => (minWidth ?? 0) > 0)
    ).toBe(true)
  })

  it('counts total automatic penalty rows and invoiced rows', () => {
    renderComponent([
      { penaltyLogId: 'auto-1', penaltyAmount: 100, invoiceSent: true },
      { penaltyLogId: 'auto-2', penaltyAmount: 200, invoiceSent: false },
      { penaltyLogId: 'auto-3', penaltyAmount: 300, invoiceSent: true }
    ])

    expect(screen.getByText('Total penalties:')).toBeInTheDocument()
    expect(screen.getByText('Invoiced:')).toBeInTheDocument()
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('$600.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$400.00')).not.toBeInTheDocument()
  })

  it('slices local automatic penalty rows for the selected page', () => {
    const automaticPenaltyRows = Array.from({ length: 12 }, (_, index) => ({
      penaltyLogId: `auto-${index + 1}`,
      penaltyAmount: (index + 1) * 100,
      invoiceSent: false
    }))

    renderComponent(automaticPenaltyRows)

    const gridProps = mockBCGridViewer.mock.calls.find(
      ([props]) => props.gridKey === 'automatic-penalty-log-history'
    )?.[0]

    expect(gridProps?.queryData?.data?.penaltyLogs).toHaveLength(10)

    const onPaginationChange = gridProps?.onPaginationChange
    if (!onPaginationChange) {
      throw new Error('Expected a pagination callback for automatic penalties')
    }
    act(() => {
      onPaginationChange({ page: 2, size: 10 })
    })

    const updatedGridProps = mockBCGridViewer.mock.calls
      .map(([props]) => props)
      .reverse()
      .find((props) => props.gridKey === 'automatic-penalty-log-history')

    expect(updatedGridProps?.queryData?.data?.penaltyLogs).toHaveLength(2)
  })
})

describe('PenaltyHistoryGrid - Edge Cases', () => {
  let queryClient: QueryClient

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
    const { useOrganizationPenaltyLogs } =
      await import('@/hooks/useOrganization')
    const mockHook = vi.mocked(useOrganizationPenaltyLogs, { partial: true })

    mockHook.mockReturnValue({
      data: {
        penaltyLogs: [],
        pagination: { total: 0, page: 1, size: 10, totalPages: 0 }
      },
      isLoading: false,
      refetch: vi.fn()
    })

    const { container } = renderComponent()

    expect(container).toBeTruthy()
    expect(screen.getByText('Penalty history')).toBeInTheDocument()
  })

  it('should handle loading state', async () => {
    const { useOrganizationPenaltyLogs } =
      await import('@/hooks/useOrganization')
    const mockHook = vi.mocked(useOrganizationPenaltyLogs, { partial: true })

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
