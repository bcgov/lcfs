import React from 'react'
import { describe, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { ReportsMenu } from '../ReportsMenu'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockLocation = { pathname: '/compliance-reporting' }
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: () => mockLocation,
    useNavigate: () => vi.fn(),
    Outlet: () => <div data-test="outlet" />
  }
})

let mockUserRoles = []
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockUserRoles.map((name) => ({ name })) },
    hasRoles: (...needed) => needed.every((r) => mockUserRoles.includes(r)),
    hasAnyRole: (...needed) => needed.some((r) => mockUserRoles.includes(r))
  })
}))

let mockFeatureFlags = {}
vi.mock('@/constants/config', async () => {
  const actual = await vi.importActual('@/constants/config')
  return {
    ...actual,
    isFeatureEnabled: (flag) => !!mockFeatureFlags[flag]
  }
})

vi.mock('../ComplianceReports', () => ({
  ComplianceReports: () => <div data-test="compliance-reports" />
}))

describe('ReportsMenu - FSE / charging-sites tab visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation.pathname = '/compliance-reporting'
    mockUserRoles = []
    mockFeatureFlags = {
      manageFse: true,
      manageChargingSites: true
    }
  })

  test('hides FSE and charging-sites tabs for BCeID signing-authority-only user', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = ['Signing Authority']
    render(<ReportsMenu />, [query, theme, localization, router])

    expect(screen.queryByText('tabs.manageFSE')).not.toBeInTheDocument()
    expect(screen.queryByText('tabs.fseMap')).not.toBeInTheDocument()
    expect(
      screen.queryByText('tabs.manageChargingSites')
    ).not.toBeInTheDocument()
  })

  test('shows FSE and charging-sites tabs for BCeID compliance-reporting user when feature flags enabled', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = ['Compliance Reporting']
    render(<ReportsMenu />, [query, theme, localization, router])

    expect(screen.getByText('tabs.manageFSE')).toBeInTheDocument()
    expect(screen.getByText('tabs.fseMap')).toBeInTheDocument()
    expect(screen.getByText('tabs.manageChargingSites')).toBeInTheDocument()
  })

  test('hides FSE tabs for compliance-reporting user when feature flag is disabled', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = ['Compliance Reporting']
    mockFeatureFlags = { manageFse: false, manageChargingSites: false }
    render(<ReportsMenu />, [query, theme, localization, router])

    expect(screen.queryByText('tabs.manageFSE')).not.toBeInTheDocument()
    expect(screen.queryByText('tabs.fseMap')).not.toBeInTheDocument()
    expect(
      screen.queryByText('tabs.manageChargingSites')
    ).not.toBeInTheDocument()
  })

  test('shows FSE tabs for IDIR user regardless of feature flag', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = ['Government', 'Analyst']
    mockFeatureFlags = { manageFse: false, manageChargingSites: false }
    render(<ReportsMenu />, [query, theme, localization, router])

    expect(screen.getByText('tabs.fseIndex')).toBeInTheDocument()
    expect(screen.getByText('tabs.fseMap')).toBeInTheDocument()
    expect(screen.getByText('tabs.chargingSites')).toBeInTheDocument()
  })

  test('blocks direct navigation to FSE content for signing-authority-only user', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = ['Signing Authority']
    mockLocation.pathname = '/compliance-reporting/fse'
    render(<ReportsMenu />, [query, theme, localization, router])

    expect(screen.queryByTestId('outlet')).not.toBeInTheDocument()
  })

  test('blocks direct navigation to charging-sites for signing-authority-only user', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = ['Signing Authority']
    mockLocation.pathname = '/compliance-reporting/charging-sites'
    render(<ReportsMenu />, [query, theme, localization, router])

    expect(screen.queryByTestId('outlet')).not.toBeInTheDocument()
  })

  test('allows direct navigation to FSE content for compliance-reporting user', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    mockUserRoles = ['Compliance Reporting']
    mockLocation.pathname = '/compliance-reporting/fse'
    render(<ReportsMenu />, [query, theme, localization, router])

    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })
})
