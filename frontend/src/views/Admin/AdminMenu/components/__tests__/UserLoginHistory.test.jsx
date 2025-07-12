import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '@/themes'
import { UserLoginHistory } from '../UserLoginHistory'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock useGetUserLoginHistory hook
vi.mock('@/hooks/useUser', () => ({
  useGetUserLoginHistory: vi.fn()
}))

// Mock constants
vi.mock(
  '@/views/Admin/AdminMenu/components/_schema',
  async (importOriginal) => {
    const actual = await importOriginal()
    return {
      ...actual,
      userLoginHistoryColDefs: (t) => [
        { headerName: t('headerNameExample'), field: 'exampleField' }
      ]
    }
  }
)

// Mock BCGridViewer component
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: () => {
    return <div data-test="bc-grid-viewer">BCGridViewer</div>
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

describe('UserLoginHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the UserLoginHistory component with title and grid viewer', () => {
    customRender(<UserLoginHistory />)

    // Verify that the title renders
    expect(screen.getByText('admin:UserLoginHistory')).toBeInTheDocument()
    // Verify that the BCGridViewer component renders
    expect(screen.getByTestId('bc-grid-viewer')).toBeInTheDocument()
  })
})
