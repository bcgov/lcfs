import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import { UserActivity } from '../UserActivity'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock react-router-dom
const mockUseNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: () => mockUseNavigate
}))

// Mock constants
vi.mock('@/constants/routes', () => ({
  ROUTES: {
    TRANSFERS_VIEW: '/transfers/:transferId',
    ADMIN_ADJUSTMENT_VIEW: '/admin-adjustment/:transactionId',
    INITIATIVE_AGREEMENT_VIEW: '/initiative-agreement/:transactionId'
  },
  apiRoutes: {
    getAllUserActivities: '/users/activities/all'
  }
}))

// Variable to hold the handleRowClicked function
let handleRowClickedMock

// Mock BCDataGridServer
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  default: (props) => {
    handleRowClickedMock = props.handleRowClicked
    return <div data-test="bc-data-grid-server">BCDataGridServer</div>
  }
}))

// Custom render function with providers
const customRender = (ui, options = {}) => {
  const queryClient = new QueryClient()
  const AllTheProviders = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllTheProviders, ...options })
}

describe('UserActivity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the component', () => {
    customRender(<UserActivity />)
    expect(screen.getByText('admin:UserActivity')).toBeInTheDocument()
    expect(screen.getByTestId('bc-data-grid-server')).toBeInTheDocument()
  })

  it('navigates to the correct route when transactionType is Transfer', () => {
    customRender(<UserActivity />)
    handleRowClickedMock({
      data: { transactionType: 'Transfer', transactionId: '123' }
    })
    expect(mockUseNavigate).toHaveBeenCalledWith('/transfers/123')
  })

  it('navigates to the correct route when transactionType is AdminAdjustment', () => {
    customRender(<UserActivity />)
    handleRowClickedMock({
      data: { transactionType: 'AdminAdjustment', transactionId: '456' }
    })
    expect(mockUseNavigate).toHaveBeenCalledWith('/admin-adjustment/456')
  })

  it('navigates to the correct route when transactionType is InitiativeAgreement', () => {
    customRender(<UserActivity />)
    handleRowClickedMock({
      data: { transactionType: 'InitiativeAgreement', transactionId: '789' }
    })
    expect(mockUseNavigate).toHaveBeenCalledWith('/initiative-agreement/789')
  })
})
