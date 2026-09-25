import React from 'react'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

import { FuelCodesTabs } from '@/views/CarbonIntensity/components/FuelCodesTabs'
import { test } from '@/tests/utils/fixtures'
import { ROUTES } from '@/routes/routes'
import { roles } from '@/constants/roles'
import { CONFIG } from '@/constants/config'

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
    CONFIG.feature_flags.ciApplications = true
    mockLocation = { pathname: ROUTES.CI_APPLICATIONS.LIST, search: '' }
    mockHasAnyRole = () => false
  })
  afterEach(cleanup)

  test('shows only the public bulletin tabs for users without CI or gov roles', ({
    render,
    theme,
    router
  }) => {
    render(<FuelCodesTabs />, [theme, router])

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

  test('shows all four tabs to a CI Applicant', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = (...names) => names.includes(roles.ci_applicant)
    render(<FuelCodesTabs />, [query, theme, localization, router])

    expect(
      screen.getByText('carbonIntensity:tabs.ciApplications')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:tabs.myFuelCodes')
    ).toBeInTheDocument()
  })

  test('does not show the CI applications tab for a signing authority without the CI Applicant role', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = (...names) => names.includes(roles.signing_authority)
    render(<FuelCodesTabs />, [query, theme, localization, router])

    expect(
      screen.queryByText('carbonIntensity:tabs.ciApplications')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:tabs.myFuelCodes')
    ).not.toBeInTheDocument()
  })

  test('shows the CI applications tab for government users', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = (...names) => names.includes(roles.government)
    render(<FuelCodesTabs />, [query, theme, localization, router])

    expect(
      screen.getByText('carbonIntensity:tabs.ciApplications')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:tabs.myFuelCodes')
    ).not.toBeInTheDocument()
  })

  test('shows CI applicants the My fuel codes tab (not the internal Fuel codes tab)', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = (...names) => names.includes(roles.ci_applicant)
    render(<FuelCodesTabs />, [query, theme, localization, router])

    expect(
      screen.getByText('carbonIntensity:tabs.myFuelCodes')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:tabs.fuelCodes')
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

    test('shows the merged Fuel Codes tab set', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<FuelCodesTabs />, [query, theme, localization, router])

      expect(
        screen.getByText('carbonIntensity:tabs.ciApplications')
      ).toBeInTheDocument()
      expect(
        screen.getByText('carbonIntensity:tabs.fuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.getByText('carbonIntensity:tabs.currentFuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.getByText('carbonIntensity:tabs.archivedFuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('carbonIntensity:tabs.myFuelCodes')
      ).not.toBeInTheDocument()
    })

    test('marks the Archived tab active when on the archived bulletins page', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<FuelCodesTabs />, [query, theme, localization, router])

      const tab = screen
        .getByText('carbonIntensity:tabs.archivedFuelCodes')
        .closest('[role="tab"]')
      expect(tab.getAttribute('aria-selected')).toBe('true')
    })

    test('Archived tab navigates to /fuel-codes?type=archived', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockLocation = {
        pathname: ROUTES.FUEL_CODES.BULLETINS,
        search: ''
      }
      render(<FuelCodesTabs />, [query, theme, localization, router])

      fireEvent.click(
        screen.getByText('carbonIntensity:tabs.archivedFuelCodes')
      )
      expect(mockNavigate).toHaveBeenCalledWith(
        `${ROUTES.FUEL_CODES.LIST}?type=archived`
      )
    })
  })

  describe('variant="internal" (IDIR Fuel codes page)', () => {
    beforeEach(() => {
      mockHasAnyRole = (...names) => names.includes(roles.government)
    })

    test('renders CI applications, Fuel codes, Current and Archived tabs (no My fuel codes)', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockLocation = { pathname: ROUTES.FUEL_CODES.LIST, search: '' }
      render(<FuelCodesTabs variant="internal" />, [
        query,
        theme,
        localization,
        router
      ])

      expect(
        screen.getByText('carbonIntensity:tabs.ciApplications')
      ).toBeInTheDocument()
      expect(
        screen.getByText('carbonIntensity:tabs.fuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.getByText('carbonIntensity:tabs.currentFuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.getByText('carbonIntensity:tabs.archivedFuelCodes')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('carbonIntensity:tabs.myFuelCodes')
      ).not.toBeInTheDocument()
    })

    test('marks the Fuel codes tab active on /fuel-codes (no type param)', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockLocation = { pathname: ROUTES.FUEL_CODES.LIST, search: '' }
      render(<FuelCodesTabs variant="internal" />, [
        query,
        theme,
        localization,
        router
      ])

      const tab = screen
        .getByText('carbonIntensity:tabs.fuelCodes')
        .closest('[role="tab"]')
      expect(tab.getAttribute('aria-selected')).toBe('true')
    })

    test('marks the Current tab active on /fuel-codes?type=current', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockLocation = {
        pathname: ROUTES.FUEL_CODES.LIST,
        search: '?type=current'
      }
      render(<FuelCodesTabs variant="internal" />, [
        query,
        theme,
        localization,
        router
      ])

      const tab = screen
        .getByText('carbonIntensity:tabs.currentFuelCodes')
        .closest('[role="tab"]')
      expect(tab.getAttribute('aria-selected')).toBe('true')
    })

    test('marks the Archived tab active on /fuel-codes?type=archived', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockLocation = {
        pathname: ROUTES.FUEL_CODES.LIST,
        search: '?type=archived'
      }
      render(<FuelCodesTabs variant="internal" />, [
        query,
        theme,
        localization,
        router
      ])

      const tab = screen
        .getByText('carbonIntensity:tabs.archivedFuelCodes')
        .closest('[role="tab"]')
      expect(tab.getAttribute('aria-selected')).toBe('true')
    })

    test('Fuel codes tab navigates to /fuel-codes', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockLocation = {
        pathname: ROUTES.FUEL_CODES.LIST,
        search: '?type=archived'
      }
      render(<FuelCodesTabs variant="internal" />, [
        query,
        theme,
        localization,
        router
      ])

      fireEvent.click(screen.getByText('carbonIntensity:tabs.fuelCodes'))
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FUEL_CODES.LIST)
    })

    test('Current tab navigates to /fuel-codes?type=current', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockLocation = {
        pathname: ROUTES.FUEL_CODES.LIST,
        search: '?type=archived'
      }
      render(<FuelCodesTabs variant="internal" />, [
        query,
        theme,
        localization,
        router
      ])

      fireEvent.click(screen.getByText('carbonIntensity:tabs.currentFuelCodes'))
      expect(mockNavigate).toHaveBeenCalledWith(
        `${ROUTES.FUEL_CODES.LIST}?type=current`
      )
    })

    test('Archived tab navigates to /fuel-codes?type=archived', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockLocation = { pathname: ROUTES.FUEL_CODES.LIST, search: '' }
      render(<FuelCodesTabs variant="internal" />, [
        query,
        theme,
        localization,
        router
      ])

      fireEvent.click(
        screen.getByText('carbonIntensity:tabs.archivedFuelCodes')
      )
      expect(mockNavigate).toHaveBeenCalledWith(
        `${ROUTES.FUEL_CODES.LIST}?type=archived`
      )
    })

    test('CI applications tab navigates to /ci-applications', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      mockLocation = { pathname: ROUTES.FUEL_CODES.LIST, search: '' }
      render(<FuelCodesTabs variant="internal" />, [
        query,
        theme,
        localization,
        router
      ])

      fireEvent.click(screen.getByText('carbonIntensity:tabs.ciApplications'))
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.LIST)
    })
  })

  test('shows CI applications on the internal Fuel Codes tab set even when no role matches govRoles', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = () => false
    mockLocation = { pathname: ROUTES.FUEL_CODES.LIST, search: '' }

    render(<FuelCodesTabs variant="internal" />, [
      query,
      theme,
      localization,
      router
    ])

    expect(
      screen.getByText('carbonIntensity:tabs.ciApplications')
    ).toBeInTheDocument()
  })

  test('navigates to the corresponding route when a tab is clicked', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = (...names) => names.includes(roles.ci_applicant)
    mockLocation = { pathname: ROUTES.FUEL_CODES.BULLETINS, search: '' }
    render(<FuelCodesTabs />, [query, theme, localization, router])

    fireEvent.click(screen.getByText('carbonIntensity:tabs.ciApplications'))
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.LIST)
  })

  test('navigates to the archived bulletin URL when the Archived tab is clicked', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<FuelCodesTabs />, [query, theme, localization, router])

    fireEvent.click(screen.getByText('carbonIntensity:tabs.archivedFuelCodes'))
    expect(mockNavigate).toHaveBeenCalledWith(
      `${ROUTES.FUEL_CODES.BULLETINS}?type=archived`
    )
  })

  test('marks the CI applications tab active when on /ci-applications', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = (...names) => names.includes(roles.ci_applicant)
    render(<FuelCodesTabs />, [query, theme, localization, router])

    const ciTab = screen
      .getByText('carbonIntensity:tabs.ciApplications')
      .closest('[role="tab"]')
    expect(ciTab.getAttribute('aria-selected')).toBe('true')
  })

  test('shows CI applications as inactive on deeper CI application pages and links to the index', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = (...names) => names.includes(roles.ci_applicant)
    mockLocation = { pathname: '/ci-applications/10', search: '' }
    render(<FuelCodesTabs />, [query, theme, localization, router])

    const ciTab = screen
      .getByText('carbonIntensity:tabs.ciApplications')
      .closest('[role="tab"]')
    expect(ciTab.getAttribute('aria-selected')).toBe('false')

    fireEvent.click(screen.getByText('carbonIntensity:tabs.ciApplications'))
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.LIST)
  })

  test('shows CI applications as inactive on the add page and links to the index for government users', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = (...names) => names.includes(roles.government)
    mockLocation = { pathname: ROUTES.CI_APPLICATIONS.ADD, search: '' }
    render(<FuelCodesTabs />, [query, theme, localization, router])

    const ciTab = screen
      .getByText('carbonIntensity:tabs.ciApplications')
      .closest('[role="tab"]')
    expect(ciTab.getAttribute('aria-selected')).toBe('false')

    fireEvent.click(screen.getByText('carbonIntensity:tabs.ciApplications'))
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CI_APPLICATIONS.LIST)
  })

  test('marks the Current tab active when on /fuel-codes-bulletins with no query', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockLocation = { pathname: ROUTES.FUEL_CODES.BULLETINS, search: '' }
    render(<FuelCodesTabs />, [query, theme, localization, router])

    const tab = screen
      .getByText('carbonIntensity:tabs.currentFuelCodes')
      .closest('[role="tab"]')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  test('marks the Archived tab active when ?type=archived is in the URL', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockLocation = {
      pathname: ROUTES.FUEL_CODES.BULLETINS,
      search: '?type=archived'
    }
    render(<FuelCodesTabs />, [query, theme, localization, router])

    const tab = screen
      .getByText('carbonIntensity:tabs.archivedFuelCodes')
      .closest('[role="tab"]')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  test('does not highlight any tab when the current path matches none', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockHasAnyRole = (...names) => names.includes(roles.ci_applicant)
    mockLocation = { pathname: '/some/other/route', search: '' }
    render(<FuelCodesTabs />, [query, theme, localization, router])

    const allTabs = screen.getAllByRole('tab')
    expect(allTabs.length).toBeGreaterThan(0)
    for (const tab of allTabs) {
      expect(tab.getAttribute('aria-selected')).toBe('false')
    }
  })
})
