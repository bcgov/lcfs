import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AdminMenu } from '../AdminMenu'
import { wrapper } from '@/tests/utils/wrapper'

// Mock the useNavigate hook
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Mock the Users component
vi.mock('../AdminMenu/components/Users', () => ({
  Users: () => <div data-test="mock-users">Mocked Users Component</div>
}))

// Mock Role component
vi.mock('@/components/Role', () => ({
  Role: ({ roles, children }) => (roles.includes('administrator') ? children : null)
}))

// Mock the translation function
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

describe('AdminMenu Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  it('renders correctly with initial tab', () => {
    render(<AdminMenu tabIndex={0} />, { wrapper })
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('UserActivity')).toBeInTheDocument()
    expect(screen.getByText('UserLoginHistory')).toBeInTheDocument()
    expect(screen.getByTestId('mock-users')).toBeInTheDocument()
  })

  it('changes tab when clicked', () => {
    render(<AdminMenu tabIndex={0} />, { wrapper })
    fireEvent.click(screen.getByText('UserActivity'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/user-activity')
    fireEvent.click(screen.getByText('UserLoginHistory'))
    expect(mockNavigate).toHaveBeenCalledWith('/admin/user-login-history')
  })

  it('displays correct content for each tab with administrator role', () => {
    const { rerender } = render(<AdminMenu tabIndex={0} />, { wrapper })
    expect(screen.getByTestId('mock-users')).toBeInTheDocument()

    // Render UserActivity tab content
    rerender(<AdminMenu tabIndex={1} />)
    expect(screen.getByText('UserActivity')).toBeInTheDocument()

    // Render UserLoginHistory tab content
    rerender(<AdminMenu tabIndex={2} />)
    expect(screen.getByText('UserLoginHistory')).toBeInTheDocument()
  })
})
