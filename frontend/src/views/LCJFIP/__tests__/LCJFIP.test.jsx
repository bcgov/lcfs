import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, vi } from 'vite-plus/test'
import axe from 'axe-core'

import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useLCJFIPApplications } from '@/hooks/useLCJFIP'
import ROUTES from '@/routes/routes'
import { test } from '@/tests/utils/fixtures'
import { LCJFIP } from '../LCJFIP'

vi.mock('@/hooks/useCurrentUser')
vi.mock('@/hooks/useLCJFIP')

// The grid is AG Grid's job and has its own tests; here it records what the
// page gives it.
const mockBCGridViewer = vi.fn()
vi.mock('@/components/BCDataGrid/BCGridViewer', () => ({
  BCGridViewer: (props) => {
    mockBCGridViewer(props)
    return <div data-test="lcjfip-grid" />
  }
}))

const PAGE_TITLE = 'Low carbon jet fuel incentive program (LCJFIP) application'
const NEW_APPLICATION = 'New LCJFIP application'

const mockUser = (roleNames, isGovernmentUser) => {
  const userRoles = roleNames.map((name) => ({ name }))
  vi.mocked(useCurrentUser).mockReturnValue({
    data: { isGovernmentUser, roles: userRoles },
    hasRoles: (role) => userRoles.some((r) => r.name === role),
    hasAnyRole: (...names) =>
      names.some((name) => userRoles.some((r) => r.name === name))
  })
}

const PAGE = {
  applications: [
    {
      lcjfipApplicationId: 7,
      applicationNumber: 'JF-7',
      status: 'Draft',
      organizationName: 'LCFS Org 1',
      contactName: 'Jane Doe',
      submittedDate: null,
      incentiveType: null,
      incentiveAwardDate: null,
      authorizedDisbursement: null,
      updateDate: '2026-11-18T18:00:00Z'
    }
  ],
  pagination: { total: 1, page: 1, size: 10, totalPages: 1 }
}

// Opens the page by URL, as a user typing it into the address bar would.
const renderAtPageUrl = (render, { router, theme, i18n }) =>
  render(
    <Routes>
      <Route path={ROUTES.LCJFIP.MAIN} element={<LCJFIP />} />
      <Route
        path={ROUTES.LCJFIP.NEW_APPLICATION}
        element={<div data-test="new-application" />}
      />
      <Route path={ROUTES.DASHBOARD} element={<div data-test="dashboard" />} />
    </Routes>,
    [router.with({ initialEntries: [ROUTES.LCJFIP.MAIN] }), theme, i18n]
  )

const gridProps = () => mockBCGridViewer.mock.calls.at(-1)[0]
const gridFields = () => gridProps().columnDefs.map((column) => column.field)

describe('LCJFIP applications index', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockBCGridViewer.mockClear()
    vi.mocked(useLCJFIPApplications).mockReturnValue({
      data: PAGE,
      isLoading: false,
      isError: false,
      error: null
    })
  })

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
      expect(screen.getByTestId('lcjfip-grid')).toBeInTheDocument()
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

  test('gives an applicant the grid without the organization column', async ({
    render,
    router,
    theme,
    i18n
  }) => {
    mockUser([roles.lcjfip_applicant], false)
    renderAtPageUrl(render, { router, theme, i18n })
    await screen.findByText(PAGE_TITLE)

    expect(gridFields()).toEqual([
      'status',
      'applicationNumber',
      'contactName',
      'submittedDate',
      'incentiveAwardDate',
      'authorizedDisbursement'
    ])
    expect(gridProps().overlayNoRowsTemplate).toBe(
      'Your organization has not started an LCJFIP application.'
    )
  })

  test('gives government users the organization column', async ({
    render,
    router,
    theme,
    i18n
  }) => {
    mockUser([roles.ia_analyst], true)
    renderAtPageUrl(render, { router, theme, i18n })
    await screen.findByText(PAGE_TITLE)

    expect(gridFields()).toEqual([
      'status',
      'applicationNumber',
      'organizationName',
      'contactName',
      'submittedDate',
      'incentiveAwardDate',
      'authorizedDisbursement'
    ])
    expect(gridProps().overlayNoRowsTemplate).toBe(
      'No LCJFIP applications have been submitted.'
    )
  })

  test('pages on the server, ten rows at a time to start', async ({
    render,
    router,
    theme,
    i18n
  }) => {
    mockUser([roles.lcjfip_applicant], false)
    renderAtPageUrl(render, { router, theme, i18n })
    await screen.findByText(PAGE_TITLE)

    expect(vi.mocked(useLCJFIPApplications)).toHaveBeenCalledWith({
      page: 1,
      size: 10,
      sortOrders: [],
      filters: []
    })
    const props = gridProps()
    expect(props.dataKey).toBe('applications')
    expect(props.queryData.data).toBe(PAGE)
    expect(props.gridKey).toBe('lcjfip-applications-grid')
  })

  test('links each row to its application', async ({
    render,
    router,
    theme,
    i18n
  }) => {
    mockUser([roles.lcjfip_applicant], false)
    renderAtPageUrl(render, { router, theme, i18n })
    await screen.findByText(PAGE_TITLE)

    const { cellRendererParams } = gridProps().defaultColDef
    expect(cellRendererParams.isAbsolute).toBe(true)
    expect(cellRendererParams.url({ data: PAGE.applications[0] })).toBe(
      '/jet-fuel/lcjfip/applications/7'
    )
    expect(gridProps().getRowId({ data: PAGE.applications[0] })).toBe('7')
  })

  test('starts a new application', async ({ render, router, theme, i18n }) => {
    mockUser([roles.lcjfip_applicant], false)
    renderAtPageUrl(render, { router, theme, i18n })

    await userEvent.click(
      await screen.findByRole('button', { name: NEW_APPLICATION })
    )
    expect(await screen.findByTestId('new-application')).toBeInTheDocument()
  })

  test('gives government users no way to start an application', async ({
    render,
    router,
    theme,
    i18n
  }) => {
    mockUser([roles.ia_analyst], true)
    renderAtPageUrl(render, { router, theme, i18n })
    await screen.findByText(PAGE_TITLE)
    expect(
      screen.queryByRole('button', { name: NEW_APPLICATION })
    ).not.toBeInTheDocument()
  })

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
