import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { CreditMarketAuditLogTable } from '../CreditMarketAuditLogTable'
import { wrapper } from '@/tests/utils/wrapper'

const mockUseCreditMarketAuditLogs = vi.fn()
const mockCreditMarketAuditLogColDefs = vi.fn(() => [
  { field: 'organizationName' },
  { field: 'creditsToSell' }
])

vi.mock('@/hooks/useOrganization', () => ({
  useCreditMarketAuditLogs: (...args) => mockUseCreditMarketAuditLogs(...args)
}))

vi.mock('../_schema', () => ({
  creditMarketAuditLogColDefs: (...args) => mockCreditMarketAuditLogColDefs(...args),
  defaultAuditSortModel: [{ field: 'uploadedDate', direction: 'desc' }]
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => defaultValue || key
  })
}))

const mockGridViewer = vi.fn()
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => {
    mockGridViewer(props)
    return <div data-test="audit-grid-viewer">Audit Grid</div>
  }
}))

describe('CreditMarketAuditLogTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCreditMarketAuditLogs.mockReturnValue({
      data: {
        pagination: { total: 0, page: 1, size: 10, totalPages: 0 },
        creditMarketAuditLogs: []
      },
      isLoading: false,
      isError: false,
      error: null
    })
  })

  it('renders audit grid with expected props', async () => {
    render(<CreditMarketAuditLogTable />, { wrapper })

    await waitFor(() => {
      expect(mockGridViewer).toHaveBeenCalled()
    })

    const props = mockGridViewer.mock.calls[0][0]
    expect(props.dataKey).toBe('creditMarketAuditLogs')
    expect(props.gridKey).toBe('credit-market-audit-log-grid')
    expect(props.enableExportButton).toBe(false)
    expect(props.enableCopyButton).toBe(false)
    expect(props.defaultSortModel).toEqual([
      { field: 'uploadedDate', direction: 'desc' }
    ])
  })

  it('calls useCreditMarketAuditLogs with initial pagination defaults', async () => {
    render(<CreditMarketAuditLogTable />, { wrapper })

    await waitFor(() => {
      expect(mockUseCreditMarketAuditLogs).toHaveBeenCalled()
    })

    const [pagination] = mockUseCreditMarketAuditLogs.mock.calls[0]
    expect(pagination.page).toBe(1)
    expect(pagination.size).toBe(10)
    expect(pagination.sortOrders).toEqual([
      { field: 'uploadedDate', direction: 'desc' }
    ])
    expect(pagination.filters).toEqual([])
  })
})
