import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReleaseNotesAdmin } from '../ReleaseNotesAdmin'

const mockNavigate = vi.fn()
const mockT = vi.fn((key) => key)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}))

vi.mock('@/routes/routes', () => ({
  ROUTES: {
    RELEASE_NOTES: '/release-notes'
  }
}))

vi.mock('@/components/BCBox', () => ({
  default: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>)
}))

vi.mock('@/components/BCTypography', () => ({
  default: vi.fn(({ children, ...props }) => <p {...props}>{children}</p>)
}))

vi.mock('@/components/BCButton', () => ({
  default: vi.fn(({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ))
}))

describe('ReleaseNotesAdmin Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the title, description and how-to text', () => {
    render(<ReleaseNotesAdmin />)

    expect(mockT).toHaveBeenCalledWith('releaseNotesAdmin.title')
    expect(mockT).toHaveBeenCalledWith('releaseNotesAdmin.description')
    expect(mockT).toHaveBeenCalledWith('releaseNotesAdmin.howTo')
    expect(mockT).toHaveBeenCalledWith('releaseNotesAdmin.viewButton')
  })

  it('navigates to the public release notes page when the button is clicked', () => {
    render(<ReleaseNotesAdmin />)

    fireEvent.click(screen.getByText('releaseNotesAdmin.viewButton'))

    expect(mockNavigate).toHaveBeenCalledWith('/release-notes')
  })
})
