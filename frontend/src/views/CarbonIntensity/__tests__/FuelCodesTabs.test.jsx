import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { FuelCodesTabs } from '@/views/CarbonIntensity/components/FuelCodesTabs'
import { wrapper } from '@/tests/utils/wrapper'
import { ROUTES } from '@/routes/routes'
import { roles } from '@/constants/roles'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockNavigate = vi.fn()
let mockLocation = { pathname: ROUTES.CI_APPLICATIONS.LIST, search: '' }
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation
  }
})

let mockHasAnyRole = (..._names) => false
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: [] },
    hasAnyRole: (...names) => mockHasAnyRole(...names),
    hasRoles: (...names) => mockHasAnyRole(...names)
  })
}))

describe('FuelCodesTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation = { pathname: ROUTES.CI_APPLICATIONS.LIST, search: '' }
    mockHasAnyRole = () => false
  })
  afterEach(cleanup)

  it('shows only the public bulletin tabs for users without CI or gov roles', () => {
    render(<FuelCodesTabs />, { wrapper })

    expect(
      screen.getByText('carbonIntensity:tabs.currentFuelCodes')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:tabs.archivedFuelCodes')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:tabs.ciApplications')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:tabs.myFuelCodes')
    ).not.toBeInTheDocument()
  })

  it('shows all four tabs to a CI Applicant', () => {
    mockHasAnyRole = (...names) => names.includes(roles.ci_applicant)
    render(<FuelCodesTabs />, { wrapper })

    expect(
      screen.getByText('carbonIntensity:tabs.ciApplications')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:tabs.myFuelCodes')
    ).toBeInTheDocument()
  })

  it('shows the CI applications tab but not My fuel codes for a signing authority', () => {
    mockHasAnyRole = (...names) => names.includes(roles.signing_authority)
    render(<FuelCodesTabs />, { wrapper })

    expect(
      screen.getByText('carbonIntensity:tabs.ciApplications')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:tabs.myFuelCodes')
    ).not.toBeInTheDocument()
  })

  it('shows the CI applications tab for government users', () => {
    mockHasAnyRole = (...names) => names.includes(roles.government)
    render(<FuelCodesTabs />, { wrapper })

    expect(
      screen.getByText('carbonIntensity:tabs.ciApplications')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:tabs.myFuelCodes')
    ).not.toBeInTheDocument()
  })

  describe('government user on bulletins page (route-based internal detection)', () => {
    beforeEach(() => {
      mockHasAnyRole = (...names) => names.includes(roles.government)
      mockLocation = {
        pathname: ROUTES.FUEL_CODES.BULLETINS,
        search: '?type=archived'
      }
    })

    it('shows only Current and Archived tabs (no CI applications / My fuel codes)', () => {
      render(<FuelCodesTabs />, { wrapper })

      expect(
        screen.getByText('carbonIntensity:tabs.currentFuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.getByText('carbonIntensity:tabs.archivedFuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('carbonIntensity:tabs.ciApplications')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('carbonIntensity:tabs.myFuelCodes')
      ).not.toBeInTheDocument()
    })

    it('defaults to Current tab active when on the bulletins page', () => {
      render(<FuelCodesTabs />, { wrapper })

      const tab = screen
        .getByText('carbonIntensity:tabs.currentFuelCodes')
        .closest('[role="tab"]')
      expect(tab.getAttribute('aria-selected')).toBe('true')
    })

    it('Archived tab navigates to /fuel-codes?type=archived', () => {
      render(<FuelCodesTabs />, { wrapper })

      fireEvent.click(screen.getByText('carbonIntensity:tabs.archivedFuelCodes'))
      expect(mockNavigate).toHaveBeenCalledWith(
        `${ROUTES.FUEL_CODES.LIST}?type=archived`
      )
    })
  })

  describe('variant="internal" (IDIR Fuel codes page)', () => {
    beforeEach(() => {
      mockHasAnyRole = (...names) => names.includes(roles.government)
    })

    it('renders only Current and Archived tabs (no CI applications / My fuel codes)', () => {
      mockLocation = { pathname: ROUTES.FUEL_CODES.LIST, search: '' }
      render(<FuelCodesTabs variant="internal" />, { wrapper })

      expect(
        screen.getByText('carbonIntensity:tabs.currentFuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.getByText('carbonIntensity:tabs.archivedFuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('carbonIntensity:tabs.ciApplications')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('carbonIntensity:tabs.myFuelCodes')
      ).not.toBeInTheDocument()
    })

    it('marks the Current tab active on /fuel-codes', () => {
      mockLocation = { pathname: ROUTES.FUEL_CODES.LIST, search: '' }
      render(<FuelCodesTabs variant="internal" />, { wrapper })

      const tab = screen
        .getByText('carbonIntensity:tabs.currentFuelCodes')
        .closest('[role="tab"]')
      expect(tab.getAttribute('aria-selected')).toBe('true')
    })

    it('marks the Archived tab active on /fuel-codes?type=archived', () => {
      mockLocation = {
        pathname: ROUTES.FUEL_CODES.LIST,
        search: '?type=archived'
      }
      render(<FuelCodesTabs variant="internal" />, { wrapper })

      const tab = screen
        .getByText('carbonIntensity:tabs.archivedFuelCodes')
        .closest('[role="tab"]')
      expect(tab.getAttribute('aria-selected')).toBe('true')
    })

    it('Current tab navigates to /fuel-codes', () => {
      mockLocation = {
        pathname: ROUTES.FUEL_CODES.LIST,
        search: '?type=archived'
      }
      render(<FuelCodesTabs variant="internal" />, { wrapper })

      fireEvent.click(screen.getByText('carbonIntensity:tabs.currentFuelCodes'))
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FUEL_CODES.LIST)
    })

    it('Archived tab navigates to /fuel-codes?type=archived', () => {
      mockLocation = { pathname: ROUTES.FUEL_CODES.LIST, search: '' }
      render(<FuelCodesTabs variant="internal" />, { wrapper })

      fireEvent.click(screen.getByText('carbonIntensity:tabs.archivedFuelCodes'))
      expect(mockNavigate).toHaveBeenCalledWith(
        `${ROUTES.FUEL_CODES.LIST}?type=archived`
      )
    })
  })

  it('navigates to the corresponding route when a tab is clicked', () => {
    mockHasAnyRole = (...names) => names.includes(roles.ci_applicant)
    mockLocation = { pathname: ROUTES.FUEL_CODES.BULLETINS, search: '' }
    render(<FuelCodesTabs />, { wrapper })

    fireEvent.click(screen.getByText('carbonIntensity:tabs.ciApplications'))
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.LIST)
  })

  it('navigates to the archived bulletin URL when the Archived tab is clicked', () => {
    render(<FuelCodesTabs />, { wrapper })

    fireEvent.click(screen.getByText('carbonIntensity:tabs.archivedFuelCodes'))
    expect(mockNavigate).toHaveBeenCalledWith(
      `${ROUTES.FUEL_CODES.BULLETINS}?type=archived`
    )
  })

  it('marks the CI applications tab active when on /ci-applications', () => {
    mockHasAnyRole = (...names) => names.includes(roles.ci_applicant)
    render(<FuelCodesTabs />, { wrapper })

    const ciTab = screen
      .getByText('carbonIntensity:tabs.ciApplications')
      .closest('[role="tab"]')
    expect(ciTab.getAttribute('aria-selected')).toBe('true')
  })

  it('marks the Current tab active when on /fuel-codes-bulletins with no query', () => {
    mockLocation = { pathname: ROUTES.FUEL_CODES.BULLETINS, search: '' }
    render(<FuelCodesTabs />, { wrapper })

    const tab = screen
      .getByText('carbonIntensity:tabs.currentFuelCodes')
      .closest('[role="tab"]')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('marks the Archived tab active when ?type=archived is in the URL', () => {
    mockLocation = {
      pathname: ROUTES.FUEL_CODES.BULLETINS,
      search: '?type=archived'
    }
    render(<FuelCodesTabs />, { wrapper })

    const tab = screen
      .getByText('carbonIntensity:tabs.archivedFuelCodes')
      .closest('[role="tab"]')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })
})
