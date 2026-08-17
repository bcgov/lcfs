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

  it('renders both module tabs with Credit Ledger disabled', () => {
    render(<InitiativeAgreementTabs />, { wrapper })

    expect(
      screen.getByTestId('initiative-agreements-tab-initiativeAgreements')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('initiative-agreements-tab-creditLedger')
    ).toBeDisabled()
  })

  it('navigates to the list route when the agreements tab is selected', () => {
    mockLocation = { pathname: '/some-other-page', search: '' }
    render(<InitiativeAgreementTabs />, { wrapper })

    fireEvent.click(
      screen.getByTestId('initiative-agreements-tab-initiativeAgreements')
    )
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.INITIATIVE_AGREEMENTS.LIST)
  })

  it('does not navigate when the disabled Credit Ledger tab is clicked', () => {
    render(<InitiativeAgreementTabs />, { wrapper })

    fireEvent.click(
      screen.getByTestId('initiative-agreements-tab-creditLedger')
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
