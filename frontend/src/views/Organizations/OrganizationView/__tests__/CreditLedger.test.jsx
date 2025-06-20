import {
  render,
  screen,
  fireEvent,
  cleanup,
  within
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'

import { CreditLedger } from '../CreditLedger'

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { token: 'mock', authenticated: true, initialized: true }
  })
}))

vi.mock('@/hooks/useAuthorization', () => ({
  useAuthorization: () => ({ setForbidden: vi.fn() })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: { organization: { organizationId: '123' } } })
}))

vi.mock('@/hooks/useOrganization', () => ({
  useCurrentOrgBalance: () => ({ data: { totalBalance: 1000 } })
}))

/* grid mock — named export to match real file, uses `data-test` */
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  __esModule: true,
  BCGridViewer: () => <div data-test="mock-grid" />
}))

const mockDownload = vi.fn()
const mockLedger = {
  ledger: [
    {
      compliancePeriod: '2023',
      availableBalance: 300,
      complianceUnits: 100,
      transactionType: 'Credit',
      updateDate: '2024-01-01T00:00:00Z'
    }
  ],
  pagination: { page: 1, size: 10, total: 1, totalPages: 1 }
}

vi.mock('@/hooks/useCreditLedger', () => ({
  useCreditLedger: () => ({ data: mockLedger, isLoading: false }),
  useDownloadCreditLedger: () => mockDownload
}))

vi.mock('@/hooks/useComplianceReports', () => ({
  useCompliancePeriod: () => ({
    data: { data: [{ description: '2024', compliance_period_id: 1 }] },
    isLoading: false
  })
}))

const renderWithProviders = (ui) => {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>
  )
}

describe('CreditLedger component', () => {
  beforeEach(() => renderWithProviders(<CreditLedger />))

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the grid', () => {
    expect(screen.getByTestId('mock-grid')).toBeInTheDocument()
  })

  it('triggers download handler', () => {
    fireEvent.click(screen.getByRole('button', { name: /download excel/i }))
    expect(mockDownload).toHaveBeenCalledWith({
      orgId: '123',
      complianceYear: undefined
    })
  })

  it('populates compliance period select', () => {
    // Select is a combobox with visible text "Select"
    const combo = screen.getByRole('combobox')
    fireEvent.mouseDown(combo)
    const listbox = within(screen.getByRole('listbox'))
    expect(listbox.getByText('2024')).toBeInTheDocument()
  })
})
