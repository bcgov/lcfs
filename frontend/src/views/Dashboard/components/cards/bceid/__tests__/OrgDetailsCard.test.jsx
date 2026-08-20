import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import * as organizationHooks from '@/hooks/useOrganization'

// Mock hooks
vi.mock('@/hooks/useOrganization')

// withRole HOC — render the wrapped component regardless of roles so we can
// test OrgDetailsCard in isolation.
vi.mock('@/utils/withRole', () => ({
  __esModule: true,
  default: (Component) => Component
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        'dashboard:orgDetails.orgDetailsLabel': 'Organization Details',
        'dashboard:orgDetails.orgDetailsLoadingMsg': 'Loading organization…',
        'dashboard:orgDetails.users': 'Users',
        'dashboard:orgDetails.createNewUsrLabel': 'Create New BCeID User',
        'dashboard:orgDetails.linkTooltip': 'Opens BCeID in a new tab'
      }
      return map[key] ?? key
    }
  })
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => vi.fn()
  }
})

vi.mock('@/components/BCWidgetCard/BCWidgetCard', () => ({
  __esModule: true,
  default: ({ title, content }) => (
    <div data-test="widget-card">
      <h2 data-test="widget-title">{title}</h2>
      <div data-test="widget-content">{content}</div>
    </div>
  )
}))

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ message }) => <div data-test="loading">{message}</div>
}))

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => <span data-test="external-icon" />
}))
vi.mock('@fortawesome/free-solid-svg-icons', () => ({ faShareFromSquare: {} }))

const mockOrgData = {
  name: 'Acme Fuels Ltd.',
  phone: '250-555-0100',
  email: 'info@acme.ca',
  orgAddress: {
    streetAddress: '100 Industrial Way',
    city: 'Victoria',
    provinceState: 'BC',
    country: 'Canada',
    postalcodeZipcode: 'V8W 1A1'
  }
}

describe('OrgDetailsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderCard = async () => {
    // Dynamic import to allow vi.mock to take effect
    const { default: OrgDetailsCard } = await import(
      '@/views/Dashboard/components/cards/bceid/OrgDetailsCard'
    )
    return render(<OrgDetailsCard />, { wrapper })
  }

  it('renders a loading state while organization data is fetching', async () => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: undefined,
      isLoading: true
    })
    await renderCard()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('Loading organization…')).toBeInTheDocument()
  })

  it('renders the widget card with the organisation details title', async () => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard()
    expect(screen.getByTestId('widget-title')).toHaveTextContent(
      'Organization Details'
    )
  })

  it('renders the organisation name', async () => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard()
    expect(screen.getByText('Acme Fuels Ltd.')).toBeInTheDocument()
  })

  it('renders street address', async () => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard()
    expect(screen.getByText('100 Industrial Way')).toBeInTheDocument()
  })

  it('renders city and province', async () => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard()
    expect(screen.getByText(/Victoria.*BC/)).toBeInTheDocument()
  })

  it('renders phone and email', async () => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard()
    expect(screen.getByText('250-555-0100')).toBeInTheDocument()
    expect(screen.getByText('info@acme.ca')).toBeInTheDocument()
  })

  it('renders a "Users" navigation link', async () => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard()
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  it('renders the external BCeID link with icon', async () => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard()
    expect(screen.getByText('Create New BCeID User')).toBeInTheDocument()
    expect(screen.getByTestId('external-icon')).toBeInTheDocument()
  })

  it('opens bceid.ca in a new tab when the external link is clicked', async () => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null)

    await renderCard()
    fireEvent.click(screen.getByText('Create New BCeID User'))

    expect(openSpy).toHaveBeenCalledWith(
      'https://www.bceid.ca/',
      '_blank',
      'noopener,noreferrer'
    )
    openSpy.mockRestore()
  })
})
