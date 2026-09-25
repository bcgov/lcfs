import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import OrgInitiativeAgreementsCard from '../OrgInitiativeAgreementsCard'
import { useOrgInitiativeAgreementCounts } from '@/hooks/useDashboard'
import { wrapper } from '@/tests/utils/wrapper'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/routes/routes'
import { FILTER_KEYS } from '@/constants/common'
import { CONFIG } from '@/constants/config'

vi.mock('@/hooks/useDashboard')
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: vi.fn()
}))
vi.mock('@/utils/withRole', () => ({
  __esModule: true,
  default: (Component) => Component
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

describe('OrgInitiativeAgreementsCard (BCeID, #4893)', () => {
  const navigate = vi.fn()
  let flagWas

  beforeEach(() => {
    vi.clearAllMocks()
    useNavigate.mockReturnValue(navigate)
    flagWas = CONFIG.feature_flags?.initiativeAgreements
    CONFIG.feature_flags = {
      ...CONFIG.feature_flags,
      initiativeAgreements: true
    }
    sessionStorage.clear()
  })
  afterEach(() => {
    CONFIG.feature_flags = {
      ...CONFIG.feature_flags,
      initiativeAgreements: flagWas
    }
  })

  it("shows the organization's counts as links into the index", () => {
    useOrgInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 3, completed: 1 },
      isLoading: false
    })
    render(<OrgInitiativeAgreementsCard />, { wrapper })

    expect(screen.getByTestId('org-ia-underway')).toHaveTextContent('3')
    expect(screen.getByTestId('org-ia-completed')).toHaveTextContent('1')
    expect(screen.queryByTestId('org-ia-none')).not.toBeInTheDocument()
  })

  it('lands on the index already narrowed to the clicked status', () => {
    useOrgInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 3, completed: 0 },
      isLoading: false
    })
    render(<OrgInitiativeAgreementsCard />, { wrapper })

    fireEvent.click(screen.getByTestId('org-ia-underway'))

    expect(navigate).toHaveBeenCalledWith(ROUTES.INITIATIVE_AGREEMENTS.LIST)
    expect(
      JSON.parse(sessionStorage.getItem(FILTER_KEYS.INITIATIVE_AGREEMENTS_GRID))
    ).toEqual({
      'lifecycleStatus.status': {
        filterType: 'text',
        type: 'equals',
        filter: 'Underway'
      }
    })
  })

  it('View all clears any stored status filter', () => {
    useOrgInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 1, completed: 0 },
      isLoading: false
    })
    sessionStorage.setItem(FILTER_KEYS.INITIATIVE_AGREEMENTS_GRID, '{}')
    render(<OrgInitiativeAgreementsCard />, { wrapper })

    fireEvent.click(screen.getByTestId('org-ia-view-all'))

    expect(
      sessionStorage.getItem(FILTER_KEYS.INITIATIVE_AGREEMENTS_GRID)
    ).toBeNull()
    expect(navigate).toHaveBeenCalledWith(ROUTES.INITIATIVE_AGREEMENTS.LIST)
  })

  it('says so when the organization has no agreements, and hides zero counts', () => {
    useOrgInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 0, completed: 0 },
      isLoading: false
    })
    render(<OrgInitiativeAgreementsCard />, { wrapper })

    expect(screen.getByTestId('org-ia-none')).toBeInTheDocument()
    expect(screen.queryByTestId('org-ia-underway')).not.toBeInTheDocument()
    expect(screen.getByTestId('org-ia-view-all')).toBeInTheDocument()
  })

  it('renders nothing when the module flag is off', () => {
    CONFIG.feature_flags = {
      ...CONFIG.feature_flags,
      initiativeAgreements: false
    }
    useOrgInitiativeAgreementCounts.mockReturnValue({
      data: { underway: 3, completed: 1 },
      isLoading: false
    })
    const { container } = render(<OrgInitiativeAgreementsCard />, { wrapper })

    expect(container).toBeEmptyDOMElement()
  })
})
