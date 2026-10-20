import { test } from '@/tests/utils/fixtures'
import { screen, fireEvent } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vitest'
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

  const renderCard = async (render, providers) => {
    // Dynamic import to allow vi.mock to take effect
    const { default: OrgDetailsCard } = await import(
      '@/views/Dashboard/components/cards/bceid/OrgDetailsCard'
    )
    return render(<OrgDetailsCard />, providers)
  }

  test('renders a loading state while organization data is fetching', async ({
    render,
    theme,
    router
  }) => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: undefined,
      isLoading: true
    })
    await renderCard(render, [theme, router])
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.getByText('Loading organization…')).toBeInTheDocument()
  })

  test('renders the widget card with the organisation details title', async ({
    render,
    theme,
    router
  }) => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard(render, [theme, router])
    expect(screen.getByTestId('widget-title')).toHaveTextContent(
      'Organization Details'
    )
  })

  test('renders the organisation name', async ({ render, theme, router }) => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard(render, [theme, router])
    expect(screen.getByText('Acme Fuels Ltd.')).toBeInTheDocument()
  })

  test('renders street address', async ({ render, theme, router }) => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard(render, [theme, router])
    expect(screen.getByText('100 Industrial Way')).toBeInTheDocument()
  })

  test('renders city and province', async ({ render, theme, router }) => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard(render, [theme, router])
    expect(screen.getByText(/Victoria.*BC/)).toBeInTheDocument()
  })

  test('renders phone and email', async ({ render, theme, router }) => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard(render, [theme, router])
    expect(screen.getByText('250-555-0100')).toBeInTheDocument()
    expect(screen.getByText('info@acme.ca')).toBeInTheDocument()
  })

  test('renders a "Users" navigation link', async ({
    render,
    theme,
    router
  }) => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard(render, [theme, router])
    expect(screen.getByText('Users')).toBeInTheDocument()
  })

  test('renders the external BCeID link with icon', async ({
    render,
    theme,
    router
  }) => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    await renderCard(render, [theme, router])
    expect(screen.getByText('Create New BCeID User')).toBeInTheDocument()
    expect(screen.getByTestId('external-icon')).toBeInTheDocument()
  })

  test('opens bceid.ca in a new tab when the external link is clicked', async ({
    render,
    theme,
    router
  }) => {
    vi.mocked(organizationHooks.useOrganization).mockReturnValue({
      data: mockOrgData,
      isLoading: false
    })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    await renderCard(render, [theme, router])
    fireEvent.click(screen.getByText('Create New BCeID User'))

    expect(openSpy).toHaveBeenCalledWith(
      'https://www.bceid.ca/',
      '_blank',
      'noopener,noreferrer'
    )
    openSpy.mockRestore()
  })
})
