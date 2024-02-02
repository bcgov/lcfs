import { wrapper } from '@/utils/test/wrapper'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AddEditOrg } from './AddEditOrg'
import { useTranslation } from 'react-i18next'

// Mock Keycloak
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: { authenticated: true, token: 'mock-token' },
    initialized: true
  })
}))

describe('AddEditOrg Component Tests', () => {
  const { t } = useTranslation()
  beforeEach(() => {
    render(<AddEditOrg />, { wrapper })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the AddEditOrg component correctly', () => {
    expect(screen.getByText(/Add Organization/i)).toBeInTheDocument()
  })

  it('renders all form fields except address fields', () => {
    const formLabels = [
      /Legal name of organization/i,
      /Operating name of organization/i,
      /Email address/i,
      /Phone number/i,
      /Organization profile, EDRMS record #/i
    ]
    formLabels.forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    })

    expect(screen.getByText(/Supplier type/i)).toBeInTheDocument()
    expect(screen.getByText(/Registered for transfers/i)).toBeInTheDocument()
  })

  it('renders two sets of address fields', () => {
    const testSections = ['service-address-section', 'attorney-address-section']
    const addressLabels = [
      /Street address \/ PO box/i,
      /Address other/i,
      /City/i,
      /Province/i,
      /Country/i,
      /Postal \/ ZIP code/i
    ]

    testSections.forEach((sectionId) => {
      const section = within(screen.getByTestId(sectionId))
      addressLabels.forEach((label) => {
        expect(section.getByLabelText(label)).toBeInTheDocument()
      })
    })
  })
})
