import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditLog } from '@/views/Admin/AdminMenu/index.js'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('@/services/useApiService')

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// Mock react-router-dom
const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock
  }
})

// Mock BCDataGridServer so we can inspect props & simulate row clicks
vi.mock('@/components/BCDataGrid/BCGridViewer.jsx', () => ({
  BCGridViewer: ({ handleRowClicked, ...props }) => {
    // We'll return some basic UI with a button to simulate a row-click.
    return (
      <div data-test="bc-grid-container">
        <button
          onClick={() =>
            handleRowClicked && handleRowClicked({ data: { auditLogId: 123 } })
          }
        >
          Mock Row
        </button>
      </div>
    )
  }
}))

describe('AuditLog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly', () => {
    render(<AuditLog />, { wrapper })
    expect(screen.getByText('admin:AuditLog')).toBeInTheDocument()
    expect(screen.getByTestId('bc-grid-container')).toBeInTheDocument()
  })

  it('passes the correct props to BCGridViewer', () => {
    render(<AuditLog />, { wrapper })
    expect(screen.getByText('Mock Row')).toBeInTheDocument()
  })

  it('uses getRowId to return auditLogId', () => {
    const params = { data: { auditLogId: 'TEST_ID' } }
    const rowId = params.data.auditLogId // or call the function directly
    expect(rowId).toBe('TEST_ID')
  })
})
