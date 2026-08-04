import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest'
import { PublicDashboardRoute } from '../PublicDashboardRoute'
import { isFeatureEnabled } from '@/constants/config'

vi.mock('@/constants/config', async () => {
  const actual = await vi.importActual<typeof import('@/constants/config')>(
    '@/constants/config'
  )
  return {
    ...actual,
    isFeatureEnabled: vi.fn()
  }
})

vi.mock('../PublicDashboard', () => ({
  PublicDashboard: () => <div data-test="new-public-dashboard" />
}))

vi.mock('../LegacyPublicDashboard', () => ({
  LegacyPublicDashboard: () => <div data-test="legacy-public-dashboard" />
}))

const mockedIsFeatureEnabled = isFeatureEnabled as unknown as Mock

describe('PublicDashboardRoute', () => {
  beforeEach(() => {
    mockedIsFeatureEnabled.mockReset()
  })

  it('renders the new Credit Market public dashboard when the flag is enabled', () => {
    mockedIsFeatureEnabled.mockReturnValue(true)

    render(<PublicDashboardRoute />)

    expect(screen.getByTestId('new-public-dashboard')).toBeInTheDocument()
    expect(
      screen.queryByTestId('legacy-public-dashboard')
    ).not.toBeInTheDocument()
  })

  it('falls back to the legacy public dashboard when the flag is disabled', () => {
    mockedIsFeatureEnabled.mockReturnValue(false)

    render(<PublicDashboardRoute />)

    expect(screen.getByTestId('legacy-public-dashboard')).toBeInTheDocument()
    expect(
      screen.queryByTestId('new-public-dashboard')
    ).not.toBeInTheDocument()
  })
})
