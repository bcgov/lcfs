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

// Mock BCGridViewer component
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: () => <div data-test="mocked-data-grid">Mocked DataGrid</div>
}))

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      users: [],
      pagination: { total: 0, page: 1, size: 10 }
    },
    isLoading: false,
    isError: false,
    error: null
  })
}))

// Mock API Service
vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    post: vi.fn().mockResolvedValue({
      data: {
        users: [],
        pagination: { total: 0, page: 1, size: 10 }
      }
    })
  })
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

  it('renders BCGridViewer with correct props', () => {
    render(<Users />, { wrapper })
    expect(screen.getByTestId('mocked-data-grid')).toBeInTheDocument()
  })
})
