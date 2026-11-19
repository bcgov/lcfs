import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, vi } from 'vite-plus/test'

import { CONFIG, FEATURE_FLAGS } from '@/constants/config'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ROUTES from '@/routes/routes'
import { test } from '@/tests/utils/fixtures'
import { lcjfipRoutes } from '../lcjfipRoutes'

vi.mock('@/hooks/useCurrentUser')

const PAGE_TITLE = 'Low carbon jet fuel incentive program (LCJFIP)'
const initialFlag = CONFIG.feature_flags.lcjfip

const renderRoute = (render, { router, theme, i18n }) => {
  const [route] = lcjfipRoutes
  return render(
    <Routes>
      <Route path={route.path} element={route.element} />
      <Route path={ROUTES.DASHBOARD} element={<div data-test="dashboard" />} />
    </Routes>,
    [router.with({ initialEntries: [ROUTES.LCJFIP.MAIN] }), theme, i18n]
  )
}

describe('lcjfipRoutes', () => {
  afterEach(() => {
    CONFIG.feature_flags.lcjfip = initialFlag
  })

  test('serves the page under Jet fuel, titled LCJFIP for the breadcrumb', () => {
    expect(FEATURE_FLAGS.LCJFIP).toBe('lcjfip')
    expect(lcjfipRoutes).toHaveLength(1)
    const [route] = lcjfipRoutes
    expect(route.path).toBe('/jet-fuel/lcjfip')
    expect(route.handle.title).toBe('LCJFIP')
    expect(route.handle.crumb()).toBe('LCJFIP')
  })

  test('renders the page when the flag is on', async ({
    render,
    router,
    theme,
    i18n
  }) => {
    CONFIG.feature_flags.lcjfip = true
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { isGovernmentUser: true, roles: [{ name: roles.director }] }
    })
    renderRoute(render, { router, theme, i18n })

    expect(await screen.findByText(PAGE_TITLE)).toBeInTheDocument()
  })

  test('sends everyone to the dashboard when the flag is off', async ({
    render,
    router,
    theme,
    i18n
  }) => {
    CONFIG.feature_flags.lcjfip = false
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { isGovernmentUser: true, roles: [{ name: roles.director }] }
    })
    renderRoute(render, { router, theme, i18n })

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument()
    expect(screen.queryByText(PAGE_TITLE)).not.toBeInTheDocument()
  })
})
