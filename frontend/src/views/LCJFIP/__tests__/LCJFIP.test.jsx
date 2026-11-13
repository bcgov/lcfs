import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, vi } from 'vite-plus/test'
import axe from 'axe-core'

import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ROUTES from '@/routes/routes'
import { test } from '@/tests/utils/fixtures'
import { LCJFIP } from '../LCJFIP'

vi.mock('@/hooks/useCurrentUser')

const PAGE_TITLE = 'Low carbon jet fuel incentive program (LCJFIP)'

const mockUser = (roleNames, isGovernmentUser) => {
  const userRoles = roleNames.map((name) => ({ name }))
  vi.mocked(useCurrentUser).mockReturnValue({
    data: { isGovernmentUser, roles: userRoles },
    hasRoles: (role) => userRoles.some((r) => r.name === role),
    hasAnyRole: (...names) =>
      names.some((name) => userRoles.some((r) => r.name === name))
  })
}

// Opens the page by URL, as a user typing it into the address bar would.
const renderAtPageUrl = (render, { router, theme, i18n }) =>
  render(
    <Routes>
      <Route path={ROUTES.LCJFIP.MAIN} element={<LCJFIP />} />
      <Route path={ROUTES.DASHBOARD} element={<div data-test="dashboard" />} />
    </Routes>,
    [router.with({ initialEntries: [ROUTES.LCJFIP.MAIN] }), theme, i18n]
  )

describe('LCJFIP page', () => {
  test.for([
    ['LCJFIP Applicant (BCeID)', roles.lcjfip_applicant, false],
    ['LCJFIP Administrator (BCeID)', roles.lcjfip_administrator, false],
    ['IA Analyst (IDIR)', roles.ia_analyst, true],
    ['IA Manager (IDIR)', roles.ia_manager, true],
    ['Director (IDIR)', roles.director, true]
  ])(
    'opens for %s with the page title',
    async ([, role, isGovernmentUser], { render, router, theme, i18n }) => {
      mockUser([role], isGovernmentUser)
      renderAtPageUrl(render, { router, theme, i18n })

      expect(
        await screen.findByRole('heading', { level: 2, name: PAGE_TITLE })
      ).toBeInTheDocument()
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument()
    }
  )

  test.for([
    ['Analyst (IDIR)', [roles.government, roles.analyst], true],
    [
      'Compliance Manager (IDIR)',
      [roles.government, roles.compliance_manager],
      true
    ],
    ['Administrator (IDIR)', [roles.government, roles.administrator], true],
    ['IA Proponent (BCeID)', [roles.supplier, roles.ia_proponent], false],
    [
      'Compliance Reporting (BCeID)',
      [roles.supplier, roles.compliance_reporting],
      false
    ],
    ['CI Applicant (BCeID)', [roles.supplier, roles.ci_applicant], false]
  ])(
    'sends %s to the dashboard when the URL is entered directly',
    async (
      [, userRoles, isGovernmentUser],
      { render, router, theme, i18n }
    ) => {
      mockUser(userRoles, isGovernmentUser)
      renderAtPageUrl(render, { router, theme, i18n })

      expect(await screen.findByTestId('dashboard')).toBeInTheDocument()
      expect(screen.queryByText(PAGE_TITLE)).not.toBeInTheDocument()
    }
  )

  test('has no machine-detectable accessibility violations', async ({
    render,
    router,
    theme,
    i18n
  }) => {
    mockUser([roles.lcjfip_applicant], false)
    const { container } = renderAtPageUrl(render, { router, theme, i18n })
    await screen.findByText(PAGE_TITLE)

    const results = await axe.run(container, {
      rules: {
        // jsdom does not paint, so contrast cannot be judged here.
        'color-contrast': { enabled: false },
        // The page renders without the layout's landmarks and hidden h1.
        region: { enabled: false },
        'page-has-heading-one': { enabled: false }
      }
    })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})
