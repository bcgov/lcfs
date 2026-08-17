import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { InitiativeAgreements } from '../InitiativeAgreements'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}))

vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({
    keycloak: {
      token: 'mock-token',
      authenticated: true,
      initialized: true
    }
  })
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: [{ name: 'IA Analyst' }] },
    hasRoles: (...names) => names.includes(roles.ia_analyst),
    hasAnyRole: (...names) => names.includes(roles.ia_analyst)
  })
}))

describe('InitiativeAgreements', () => {
  it('renders the list scaffold with the module tabs for an IA analyst', () => {
    render(<InitiativeAgreements />, { wrapper })

    expect(
      screen.getByTestId('initiative-agreements-title')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('initiative-agreements-tab-initiativeAgreements')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('initiative-agreements-tab-creditLedger')
    ).toBeInTheDocument()
  })
})
