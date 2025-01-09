import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Users } from '../Users.jsx'
import { wrapper } from '@/tests/utils/wrapper.jsx'

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

// Mock BCDataGridServer component
vi.mock('@/components/BCDataGrid/BCDataGridServer', () => ({
  default: () => <div data-test="mocked-data-grid">Mocked DataGrid</div>
}))

describe('Users Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<Users />, { wrapper })
    expect(screen.getByText('admin:Users')).toBeInTheDocument()
  })

  it('displays the New User button', () => {
    render(<Users />, { wrapper })
    const newUserButton = screen.getByText('admin:newUserBtn')
    expect(newUserButton).toBeInTheDocument()
  })

  it('navigates to add user page when New User button is clicked', async () => {
    render(<Users />, { wrapper })
    const newUserButton = screen.getByText('admin:newUserBtn')
    fireEvent.click(newUserButton)

    // Check if the navigation occurred
    await waitFor(() => {
      expect(window.location.href).toContain('/admin/users/add')
    })
  })

  it('renders BCDataGridServer with correct props', () => {
    render(<Users />, { wrapper })
    expect(screen.getByTestId('mocked-data-grid')).toBeInTheDocument()
  })
})
