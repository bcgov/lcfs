import { render } from '@testing-library/react'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { faSpaceShuttle } from '@fortawesome/free-solid-svg-icons'
import { Admin } from '../Admin'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('@/components/BCButton', () => ({
  default: vi.fn(({ children, onClick, startIcon, ...props }) => (
    <button data-test="bc-button" onClick={onClick} {...props}>
      {startIcon}
      {children}
    </button>
  ))
}))

vi.mock('@/components/BCTypography', () => ({
  default: vi.fn(({ children, ...props }) => (
    <span data-test="bc-typography" {...props}>
      {children}
    </span>
  ))
}))

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: vi.fn((props) => (
    <i data-test="font-awesome-icon" {...props}></i>
  ))
}))

describe('Admin Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(<Admin />)
      expect(container.querySelector('[data-test="bc-button"]')).toBeTruthy()
    })

    it('renders button and typography components', () => {
      const { container } = render(<Admin />)
      
      expect(container.querySelector('[data-test="bc-button"]')).toBeTruthy()
      expect(container.querySelector('[data-test="bc-typography"]')).toBeTruthy()
    })

    it('renders button with admin settings text', () => {
      const { container } = render(<Admin />)
      
      const typography = container.querySelector('[data-test="bc-typography"]')
      expect(typography).toBeTruthy()
      expect(typography.textContent).toBe('Admin Settings')
    })

    it('renders icon within button', () => {
      const { container } = render(<Admin />)
      
      const button = container.querySelector('[data-test="bc-button"]')
      const icon = button.querySelector('[data-test="font-awesome-icon"]')
      expect(icon).toBeTruthy()
    })
  })

  describe('User Interactions', () => {
    it('calls navigate with /admin/users when button is clicked', async () => {
      const user = userEvent.setup()
      
      render(<Admin />)
      
      const button = document.querySelector('[data-test="bc-button"]')
      await user.click(button)
      
      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith('/admin/users')
    })
  })
})