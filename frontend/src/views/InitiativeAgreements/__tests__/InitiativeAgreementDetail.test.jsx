import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { roles } from '@/constants/roles'
import { wrapper } from '@/tests/utils/wrapper'
import { InitiativeAgreementDetail } from '../InitiativeAgreementDetail'

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

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useParams: () => ({ initiativeAgreementId: '5' })
  }
})

describe('InitiativeAgreementDetail', () => {
  it('renders the detail scaffold sections with the reference number', () => {
    render(<InitiativeAgreementDetail />, { wrapper })

    expect(
      screen.getByTestId('initiative-agreement-detail-title')
    ).toHaveTextContent('IA5')
    expect(
      screen.getByTestId('initiative-agreement-header-section')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('initiative-agreement-brief-section')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('initiative-agreement-documents-section')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('initiative-agreement-actions-section')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('initiative-agreement-comments-section')
    ).toBeInTheDocument()
  })
})
