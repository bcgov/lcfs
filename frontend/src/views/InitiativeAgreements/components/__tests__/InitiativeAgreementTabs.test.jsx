import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { InitiativeAgreementTabs } from '../InitiativeAgreementTabs'
import { wrapper } from '@/tests/utils/wrapper'
import { ROUTES } from '@/routes/routes'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockNavigate = vi.fn()
let mockLocation = { pathname: ROUTES.INITIATIVE_AGREEMENTS.LIST, search: '' }
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation
  }
})

describe('InitiativeAgreementTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation = { pathname: ROUTES.INITIATIVE_AGREEMENTS.LIST, search: '' }
  })
  afterEach(cleanup)

  it('renders the module tab', () => {
    render(<InitiativeAgreementTabs />, { wrapper })

    expect(
      screen.getByTestId('initiative-agreements-tab-initiativeAgreements')
    ).toBeInTheDocument()
  })

  it('no longer offers a Credit Ledger tab', () => {
    // It was a disabled placeholder; the ledger is organization-scoped
    // and no index-level behaviour was ever defined for it.
    render(<InitiativeAgreementTabs />, { wrapper })

    expect(
      screen.queryByTestId('initiative-agreements-tab-creditLedger')
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/credit ledger/i)).not.toBeInTheDocument()
  })
})
