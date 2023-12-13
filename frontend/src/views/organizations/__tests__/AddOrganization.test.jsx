import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { BrowserRouter as Router } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import AddOrganization from '../AddOrganization'

// Mock Keycloak
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { authenticated: true, token: 'mock-token' },
    initialized: true
  })
}))

const renderComponent = () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <Router>
        <AddOrganization />
      </Router>
    </QueryClientProvider>
  )
}

describe('AddOrganization Component Tests', () => {
  beforeEach(() => {
    renderComponent()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the AddOrganization component correctly', () => {
    expect(screen.getByText(/Add Organization/i)).toBeInTheDocument()
  })

  it('renders all form fields except address fields', () => {
    const formLabels = [
      /Legal Name of Organization/i,
      /Operating Name of Organization/i,
      /Email Address/i,
      /Phone Number/i,
      /Organization Profile, EDRMS Record #/i
    ]
    formLabels.forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    })

    expect(screen.getByText(/Supplier Type/i)).toBeInTheDocument()
    expect(screen.getByText(/Registered For Transfers/i)).toBeInTheDocument()
  })

  it('renders two sets of address fields', () => {
    const testSections = ['service-address-section', 'attorney-address-section']
    const addressLabels = [
      /Street Address \/ PO Box/i,
      /Address Other/i,
      /City/i,
      /Province/i,
      /Country/i,
      /Postal \/ ZIP Code/i
    ]

    testSections.forEach((sectionId) => {
      const section = within(screen.getByTestId(sectionId))
      addressLabels.forEach((label) => {
        expect(section.getByLabelText(label)).toBeInTheDocument()
      })
    })
  })
})
