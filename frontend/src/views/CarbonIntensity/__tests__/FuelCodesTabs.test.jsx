import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { FuelCodesTabs } from '@/views/CarbonIntensity/components/FuelCodesTabs'
import { wrapper } from '@/tests/utils/wrapper'
import { ROUTES } from '@/routes/routes'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const mockNavigate = vi.fn()
let mockLocation = { pathname: ROUTES.CI_APPLICATIONS.LIST }
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation
  }
})

describe('FuelCodesTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation = { pathname: ROUTES.CI_APPLICATIONS.LIST }
  })
  afterEach(cleanup)

  it('renders the four tab labels', () => {
    render(<FuelCodesTabs />, { wrapper })
    expect(
      screen.getByText('carbonIntensity:tabs.ciApplications')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:tabs.myFuelCodes')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:tabs.currentFuelCodes')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:tabs.archivedFuelCodes')
    ).toBeInTheDocument()
  })

  it('navigates to the corresponding route when a tab is clicked', () => {
    render(<FuelCodesTabs />, { wrapper })
    fireEvent.click(screen.getByText('carbonIntensity:tabs.myFuelCodes'))
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FUEL_CODES.LIST)
  })

  it('marks the CI applications tab active when on /ci-applications', () => {
    render(<FuelCodesTabs />, { wrapper })
    const ciTab = screen.getByText('carbonIntensity:tabs.ciApplications')
      .closest('[role="tab"]')
    expect(ciTab.getAttribute('aria-selected')).toBe('true')
  })

  it('marks the My fuel codes tab active when on /fuel-codes', () => {
    mockLocation = { pathname: ROUTES.FUEL_CODES.LIST }
    render(<FuelCodesTabs />, { wrapper })
    const tab = screen.getByText('carbonIntensity:tabs.myFuelCodes')
      .closest('[role="tab"]')
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })
})
