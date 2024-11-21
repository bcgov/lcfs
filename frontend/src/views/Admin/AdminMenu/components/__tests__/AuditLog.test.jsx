import { render, screen, fireEvent } from '@testing-library/react'
import { AuditLog } from '../AuditLog'
import { useNavigate } from 'react-router-dom'
import { vi } from 'vitest'

// Mock necessary modules
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useNavigate: vi.fn()
}))

// Mock the BCBox component
vi.mock('@/components/BCBox', () => ({
  default: ({ children }) => <div data-testid="bcbox">{children}</div>
}))

// Mock the BCDataGridServer component
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  default: ({ handleRowClicked }) => (
    <div data-testid="bc-datagrid-server">
      <button onClick={() => handleRowClicked({ data: { auditLogId: 123 } })}>
        Mock Row
      </button>
    </div>
  )
}))

describe('AuditLog Component', () => {
  const navigateMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useNavigate.mockReturnValue(navigateMock)
  })

  it('renders correctly', () => {
    render(<AuditLog />)
    expect(screen.getByText('admin:AuditLog')).toBeInTheDocument()
  })

  it('navigates to the correct path when a row is clicked', () => {
    render(<AuditLog />)
    const mockRowButton = screen.getByText('Mock Row')
    fireEvent.click(mockRowButton)
    expect(navigateMock).toHaveBeenCalledWith('/admin/audit-log/123')
  })
})
