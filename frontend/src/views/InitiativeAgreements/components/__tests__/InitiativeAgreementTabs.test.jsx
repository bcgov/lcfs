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

const selected = (key) =>
  screen
    .getByTestId(`initiative-agreements-tab-${key}`)
    .getAttribute('aria-selected')

describe('InitiativeAgreementTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation = { pathname: ROUTES.INITIATIVE_AGREEMENTS.LIST, search: '' }
  })
  afterEach(cleanup)

  it('offers the agreements and designated actions tabs, and no ledger', () => {
    render(<InitiativeAgreementTabs />, { wrapper })

    expect(
      screen.getByTestId('initiative-agreements-tab-initiativeAgreements')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('initiative-agreements-tab-designatedActions')
    ).toBeInTheDocument()
    // Removed by an earlier product decision; the wireframe still shows
    // it, and #5078 leaves it out on purpose.
    expect(screen.queryByText(/credit ledger/i)).not.toBeInTheDocument()
  })

  it('selects the agreements tab on the index and an agreement page', () => {
    render(<InitiativeAgreementTabs />, { wrapper })
    expect(selected('initiativeAgreements')).toBe('true')
    cleanup()

    mockLocation = { pathname: '/initiative-agreements/7', search: '' }
    render(<InitiativeAgreementTabs />, { wrapper })
    expect(selected('initiativeAgreements')).toBe('true')
    expect(selected('designatedActions')).toBe('false')
  })

  it('selects the actions tab on its list and on an action page', () => {
    mockLocation = {
      pathname: ROUTES.INITIATIVE_AGREEMENTS.ACTIONS_LIST,
      search: ''
    }
    render(<InitiativeAgreementTabs />, { wrapper })
    expect(selected('designatedActions')).toBe('true')
    cleanup()

    // The action's page belongs with the actions tab however it was
    // reached, even though its URL lives under the agreement.
    mockLocation = {
      pathname: '/initiative-agreements/7/designated-actions/12',
      search: ''
    }
    render(<InitiativeAgreementTabs />, { wrapper })
    expect(selected('designatedActions')).toBe('true')
    expect(selected('initiativeAgreements')).toBe('false')
  })

  it('navigates to the tab that is clicked', () => {
    render(<InitiativeAgreementTabs />, { wrapper })

    fireEvent.click(
      screen.getByTestId('initiative-agreements-tab-designatedActions')
    )

    expect(mockNavigate).toHaveBeenCalledWith(
      ROUTES.INITIATIVE_AGREEMENTS.ACTIONS_LIST
    )
  })
})
