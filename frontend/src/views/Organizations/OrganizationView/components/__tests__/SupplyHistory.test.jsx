import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import { SupplyHistory } from '../SupplyHistory'
import { roles } from '@/constants/roles'
import theme from '@/themes'

const mockNavigate = vi.fn()
const mockUseOrganizationFuelSupply = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('echarts-for-react', () => ({
  default: () => <div data-test="echarts" />
}))

vi.mock('@/hooks/useFuelSupply', () => ({
  useOrganizationFuelSupply: (...args) => mockUseOrganizationFuelSupply(...args)
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: {
      organization: { organizationId: '1' },
      roles: [{ name: roles.government }]
    },
    hasRoles: (role) => role === roles.government
  })
}))

vi.mock('@/views/Transactions/components/OrganizationList', () => ({
  default: ({ onOrgChange }) => (
    <button
      data-test="select-organization"
      onClick={() =>
        onOrgChange({ id: '3', name: 'LCFS Org 3', label: 'LCFS Org 3' })
      }
    >
      Select organization
    </button>
  )
}))

vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: () => <div data-test="grid" />
}))

const queryData = {
  data: {
    fuelSupplies: [],
    analytics: {
      totalByYear: { 2023: 100, 2024: 200, 2025: 300 },
      selectedYearSummary: {},
      totalReports: 0
    },
    pagination: { page: 1, size: 10, total: 0, totalPages: 0 }
  },
  isLoading: false,
  isError: false
}

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <SupplyHistory organizationId="1" />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

describe('SupplyHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockUseOrganizationFuelSupply.mockReturnValue(queryData)
  })

  it('uses a set compliance period filter for the selected year range', async () => {
    const user = userEvent.setup()
    renderComponent()

    const [fromSelect, toSelect] = screen.getAllByRole('combobox')
    await user.click(fromSelect)
    await user.click(screen.getByRole('option', { name: '2023' }))
    await user.click(toSelect)
    expect(screen.queryByRole('option', { name: '2023' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: '2025' }))

    await waitFor(() => {
      expect(mockUseOrganizationFuelSupply).toHaveBeenLastCalledWith(
        '1',
        expect.objectContaining({
          filters: [
            {
              field: 'compliancePeriod',
              values: ['2023', '2024', '2025'],
              type: 'set',
              filterType: 'set'
            }
          ]
        }),
        { enabled: true }
      )
    })
  })

  it('navigates to the selected organization supply history route', () => {
    renderComponent()

    fireEvent.click(screen.getByTestId('select-organization'))

    expect(mockNavigate).toHaveBeenCalledWith(
      '/organizations/3/supply-history'
    )
  })
})
