import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, vi } from 'vite-plus/test'
import axe from 'axe-core'

import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ROUTES from '@/routes/routes'
import { test } from '@/tests/utils/fixtures'
import { LCJFIPApplication } from '../LCJFIPApplication'
import { OPERATOR_LIST_URL } from '../components/ApplicantSection'

vi.mock('@/hooks/useCurrentUser')
vi.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { authenticated: true, token: 'test' } })
}))
vi.mock('@/contexts/AuthorizationContext', () => ({
  useAuthorization: () => ({
    setForbidden: vi.fn(),
    addErrorRef: vi.fn(),
    setErrorStatus: vi.fn(),
    serverErrorBlockedRef: { current: false }
  })
}))
// The comment thread has its own tests; here it only needs the right entity.
vi.mock('@/components/Comments', () => ({
  default: ({ entityType, entityId, commentMode }) => (
    <div
      data-test="comment-thread"
      data-entity-type={entityType}
      data-entity-id={entityId}
      data-mode={commentMode}
    />
  )
}))

const PROGRAM_EMAIL = 'strategicinvestment.lcfs@gov.bc.ca'
const CASH = 'Cash incentive'
const CREDIT = 'LCFS credit option'
const TRANSFER = 'LCFS credit option - Fuel supplier incentive transfer'

const REFERENCE_DATA = {
  carTypes: [
    { id: 1, name: 'CAR 701 - Foreign air operations' },
    { id: 4, name: 'CAR 705 - Airline operations' }
  ],
  certificateTypes: [
    { id: 1, name: 'Domestic' },
    { id: 5, name: 'Private' }
  ],
  feedstockSources: [
    { id: 1, name: 'Used cooking oil (UCO)' },
    { id: 2, name: 'Tallow / animal fats' }
  ],
  incentiveOptions: [
    { id: 1, name: CASH, incentiveType: 'Cash', requiresFuelSupplier: false },
    {
      id: 2,
      name: CREDIT,
      incentiveType: 'Credit',
      requiresFuelSupplier: false
    },
    {
      id: 3,
      name: TRANSFER,
      incentiveType: 'Credit',
      requiresFuelSupplier: true
    }
  ],
  incentiveRates: [
    {
      incentiveType: 'Cash',
      ciLowerBound: 10,
      ciUpperBound: null,
      maxRatePerLitre: 0.75,
      description: 'CI greater than 10 gCO2e/MJ'
    },
    {
      incentiveType: 'Cash',
      ciLowerBound: null,
      ciUpperBound: 10,
      maxRatePerLitre: 1.125,
      description: 'CI less than or equal to 10 gCO2e/MJ'
    },
    {
      incentiveType: 'Credit',
      ciLowerBound: 10,
      ciUpperBound: null,
      maxRatePerLitre: 0.005,
      description: 'CI greater than 10 gCO2e/MJ'
    },
    {
      incentiveType: 'Credit',
      ciLowerBound: null,
      ciUpperBound: 10,
      maxRatePerLitre: 0.0075,
      description: 'CI less than or equal to 10 gCO2e/MJ'
    }
  ],
  maxPricePremiumRange: 0.25
}

const purchaseRow = (id, overrides = {}) => ({
  lcjfipPurchaseDetailId: id,
  estimatedVolume: 500000,
  anticipatedDeliveryDate: '2027-03-31',
  feedstockSourceIds: [1],
  estimatedBlendPercentage: 30,
  assumedJetAPrice: 0.9,
  pricePremiumFrom: 1.5,
  pricePremiumTo: 1.7,
  ...overrides
})

const draftApplication = (overrides = {}) => ({
  lcjfipApplicationId: 7,
  applicationNumber: 'LCJFIP-7',
  status: 'Draft',
  organization: {
    organizationId: 1,
    name: 'Test Airline',
    operatingName: null,
    email: 'org@example.com',
    phone: '555-0199',
    addressLine: '1 Test Way, Vancouver, BC'
  },
  contact: {
    userProfileId: 5,
    firstName: 'Jane',
    lastName: 'Doe',
    title: 'Supplier - Jet fuel',
    email: 'jane@example.com',
    phone: '555-0100'
  },
  carTypeIds: [4],
  certificateTypeId: 1,
  incentiveOptionId: 1,
  incentiveType: 'Cash',
  estimatedCarbonIntensity: 8.5,
  fuelCode: null,
  requestedIncentiveVolume: 1000000,
  totalEstimatedVolume: 1000000,
  maxIncentiveRatePerLitre: 1.125,
  estimatedIncentiveAmount: 1125000,
  fuelSupplierOrganization: null,
  fuelSupplierLegalName: null,
  fuelSupplierContactFirstName: null,
  fuelSupplierContactLastName: null,
  fuelSupplierContactEmail: null,
  applicationPeriod: null,
  signedBy: null,
  signedDate: null,
  purchaseDetails: [purchaseRow(11, { estimatedVolume: 1000000 })],
  createDate: '2026-11-18T18:00:00Z',
  updateDate: '2026-11-18T18:00:00Z',
  ...overrides
})

const submittedApplication = () =>
  draftApplication({
    status: 'Submitted',
    signedBy: 'Jane Doe',
    signedDate: '2026-11-18T18:00:00Z',
    updateDate: '2026-11-18T19:00:00Z'
  })

const mockApplicant = () => {
  const userRoles = [{ name: roles.lcjfip_applicant }]
  vi.mocked(useCurrentUser).mockReturnValue({
    data: {
      isGovernmentUser: false,
      roles: userRoles,
      firstName: 'Jane',
      lastName: 'Doe',
      title: 'Supplier - Jet fuel',
      email: 'jane@example.com',
      phone: '555-0100',
      organization: { organizationId: 1, name: 'Test Airline' }
    },
    hasRoles: (role) => userRoles.some((r) => r.name === role),
    hasAnyRole: (...names) =>
      names.some((name) => userRoles.some((r) => r.name === name))
  })
}

/** Serves the LCJFIP endpoints and records what the page sends. */
const mockApi = (
  server,
  { application = draftApplication(), ...handlers } = {}
) => {
  const calls = { saves: [], creates: [], submits: [], deletes: 0 }
  server.httpOverwrite('get', '/lcjfip/reference-data', () =>
    HttpResponse.json(REFERENCE_DATA)
  )
  server.httpOverwrite('get', '/lcjfip/fuel-codes', () =>
    HttpResponse.json([
      {
        fuelCodeId: 5,
        fuelCode: 'C101.0',
        carbonIntensity: 6.25,
        company: 'Test producer'
      }
    ])
  )
  server.httpOverwrite('get', '/organizations/registered/external', () =>
    HttpResponse.json([{ organizationId: 9, name: 'Registered supplier' }])
  )
  server.httpOverwrite('get', '/lcjfip/applications/7', () =>
    HttpResponse.json(application)
  )
  server.httpOverwrite('put', '/lcjfip/applications/7', async ({ request }) => {
    const body = await request.json()
    calls.saves.push(body)
    return HttpResponse.json({
      ...application,
      updateDate: '2026-11-18T18:30:00Z'
    })
  })
  server.httpOverwrite('post', '/lcjfip/applications', async ({ request }) => {
    calls.creates.push(await request.json())
    return HttpResponse.json(application, { status: 201 })
  })
  server.httpOverwrite(
    'post',
    '/lcjfip/applications/7/submit',
    handlers.submit ??
      (async ({ request }) => {
        calls.submits.push(await request.json())
        return HttpResponse.json(submittedApplication())
      })
  )
  server.httpOverwrite('delete', '/lcjfip/applications/7', () => {
    calls.deletes += 1
    return new HttpResponse(null, { status: 204 })
  })
  return calls
}

const renderAt = (url, { render, query, theme, localization, router, i18n }) =>
  render(
    <Routes>
      <Route
        path={ROUTES.LCJFIP.NEW_APPLICATION}
        element={<LCJFIPApplication />}
      />
      <Route path={ROUTES.LCJFIP.APPLICATION} element={<LCJFIPApplication />} />
      <Route path={ROUTES.LCJFIP.MAIN} element={<div data-test="landing" />} />
      <Route path={ROUTES.DASHBOARD} element={<div data-test="dashboard" />} />
    </Routes>,
    [query, theme, localization, router.with({ initialEntries: [url] }), i18n]
  )

const openDraft = async (fixtures, options) => {
  mockApplicant()
  const calls = mockApi(fixtures.server, options)
  const view = renderAt('/jet-fuel/lcjfip/applications/7', fixtures)
  await screen.findByText('Test Airline')
  return { calls, view, user: userEvent.setup() }
}

const checkAllDeclarations = async (user) => {
  for (const checkbox of within(
    screen.getByRole('group', { name: 'Declarations' })
  ).getAllByRole('checkbox')) {
    await user.click(checkbox)
  }
}

describe('LCJFIP application form', () => {
  test('shows the applicant, the steps and the program links', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    await openDraft(fixtures)

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Low carbon jet fuel incentive program \(LCJFIP\) application/
      })
    ).toBeInTheDocument()
    for (const step of [
      'Application information',
      'Sign & submit',
      'Government decision'
    ]) {
      expect(screen.getByText(step)).toBeInTheDocument()
    }
    expect(
      screen.getByText(/Eligibility cannot be determined/)
    ).toBeInTheDocument()
    expect(
      screen.getByText('Jane Doe, Supplier - Jet fuel')
    ).toBeInTheDocument()
    expect(screen.getByText('1 Test Way, Vancouver, BC')).toBeInTheDocument()

    const programLinks = screen.getAllByRole('link', { name: PROGRAM_EMAIL })
    expect(programLinks[0]).toHaveAttribute(
      'href',
      expect.stringContaining(`mailto:${PROGRAM_EMAIL}`)
    )
    const operatorList = screen.getByRole('link', {
      name: /Canada Operator List Search Tool/
    })
    expect(operatorList).toHaveAttribute('href', OPERATOR_LIST_URL)
    expect(operatorList).toHaveAttribute('target', '_blank')
  })

  test('shows the incentive rates and calculates the incentive', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { user } = await openDraft(fixtures)

    for (const rate of [
      'Up to $0.75 CAD/L',
      'Up to $1.125 CAD/L',
      'Up to 0.005 credits/L',
      'Up to 0.0075 credits/L'
    ]) {
      expect(screen.getByText(rate)).toBeInTheDocument()
    }
    const amount = () => screen.getByTestId('lcjfip-estimated-incentive-amount')
    expect(screen.getByTestId('lcjfip-total-estimated-volume')).toHaveValue(
      '1,000,000 L'
    )
    // Calculated, so read-only, but not greyed out on an editable draft.
    expect(screen.getByTestId('lcjfip-total-estimated-volume')).toBeEnabled()
    expect(amount()).toBeEnabled()
    // 1,000,000 L at the "10 or less" cash rate.
    expect(amount()).toHaveValue('$1,125,000 CAD')

    await user.click(screen.getByRole('radio', { name: CREDIT }))
    expect(amount()).toHaveValue('7,500.00 credits')

    // Without a CI, the baseline rate applies.
    await user.clear(
      screen.getByLabelText('Estimated carbon intensity (gCO2e/MJ)')
    )
    expect(amount()).toHaveValue('5,000.00 credits')
  })

  test('shows the fuel supplier fields only for the transfer option', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { user } = await openDraft(fixtures)
    const heading = 'LCFS credit option - Fuel supplier incentive transfer'

    // The heading repeats the transfer option's name, so find it by role.
    const findHeading = () => screen.queryByRole('heading', { name: heading })
    expect(findHeading()).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: TRANSFER }))
    expect(findHeading()).toBeInTheDocument()
    expect(
      screen.getByLabelText(/Fuel supplier contact email/)
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: CASH }))
    expect(findHeading()).not.toBeInTheDocument()
  })

  test('shows one set of purchase fields with their units', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { user } = await openDraft(fixtures)

    expect(
      screen.queryByRole('button', { name: /Add row/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByText('indicates a required field').length
    ).toBeGreaterThan(0)
    // Required fields say so to screen readers; the asterisk is hidden.
    expect(
      screen.getByLabelText(/Assumed Jet-A price \(CAD\/L\)\s*\(required\)/)
    ).toHaveValue('$0.9')
    expect(screen.getByTestId('lcjfip-purchase-estimatedVolume')).toHaveValue(
      '1,000,000 L'
    )
    // The date picker fills in its text after the first render.
    const dateField = screen.getByLabelText(
      /Anticipated delivery completion date/
    )
    await waitFor(() => expect(dateField).toHaveValue('2027-03-31'))

    // A draft has reached the first step, which shows a check mark.
    const progress = screen.getByTestId('lcjfip-progress')
    const step = (name) =>
      within(progress).getByText(name).closest('.MuiStep-root')
    expect(step('Application information')).toHaveClass('Mui-completed')
    expect(step('Sign & submit')).not.toHaveClass('Mui-completed')

    // Carbon intensity always shows two decimal places.
    expect(
      screen.getByRole('textbox', { name: /Estimated carbon intensity/ })
    ).toHaveValue('8.50')

    // On a phone the rates table scrolls sideways in a region that keyboard
    // users can focus.
    const ratesRegion = screen.getByRole('region', {
      name: 'Carbon intensity baseline incentive rates'
    })
    expect(ratesRegion).toHaveAttribute('tabindex', '0')
    expect(within(ratesRegion).getByRole('table')).toBeInTheDocument()

    // The blend is shown as LCJF:Jet-A and follows what is typed.
    const blend = screen.getByTestId('lcjfip-purchase-estimatedBlendPercentage')
    expect(blend).toHaveValue('30:70')
    await user.clear(blend)
    await user.type(blend, '25')
    expect(blend).toHaveValue('25:75')

    // The total for support follows the purchase volume.
    const volume = screen.getByTestId('lcjfip-purchase-estimatedVolume')
    await user.clear(volume)
    await user.type(volume, '400000')
    expect(screen.getByTestId('lcjfip-total-estimated-volume')).toHaveValue(
      '400,000 L'
    )
  })

  test('checks the price premium range as it is typed', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { user } = await openDraft(fixtures)
    const status = screen.getByTestId('lcjfip-premium-status')
    expect(status).toHaveTextContent('')

    const to = screen.getByTestId('lcjfip-purchase-pricePremiumTo')
    await user.clear(to)
    await user.type(to, '1.9')
    expect(
      within(status).getByText(
        'The price premium range must not exceed $0.25 CAD/L.'
      )
    ).toBeInTheDocument()

    await user.clear(to)
    await user.type(to, '1.4')
    expect(
      within(status).getByText(
        "The 'From' value must not be greater than 'To'."
      )
    ).toBeInTheDocument()
  })

  test('saves a draft without the declarations or the calculated amount', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { calls, user } = await openDraft(fixtures)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.saves).toHaveLength(1))
    const body = calls.saves[0]
    expect(body.carTypeIds).toEqual([4])
    expect(body.incentiveOptionId).toBe(1)
    expect(
      body.purchaseDetails.map((row) => row.lcjfipPurchaseDetailId)
    ).toEqual([11])
    expect(body).not.toHaveProperty('declarations')
    expect(body).not.toHaveProperty('estimatedIncentiveAmount')
  })

  test('saves an incomplete draft', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { calls, user } = await openDraft(fixtures, {
      application: draftApplication({
        requestedIncentiveVolume: null,
        incentiveOptionId: null,
        purchaseDetails: [
          purchaseRow(11, { estimatedVolume: null, pricePremiumTo: null })
        ]
      })
    })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.saves).toHaveLength(1))
  })

  test('keeps Submit disabled until every declaration is selected', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { user } = await openDraft(fixtures)
    const submit = screen.getByRole('button', { name: 'Submit application' })

    expect(submit).toBeDisabled()
    expect(
      screen.getByText(
        'Select all three declarations to submit the application.'
      )
    ).toBeInTheDocument()
    await checkAllDeclarations(user)
    expect(submit).toBeEnabled()
  })

  test('flags missing fields on submit and sends nothing', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { calls, user } = await openDraft(fixtures, {
      application: draftApplication({
        requestedIncentiveVolume: null,
        purchaseDetails: [purchaseRow(11, { estimatedVolume: null })]
      })
    })
    await checkAllDeclarations(user)
    await user.click(screen.getByRole('button', { name: 'Submit application' }))

    expect(await screen.findAllByText('This field is required.')).toHaveLength(
      2
    )
    expect(
      screen.getByTestId('lcjfip-purchase-estimatedVolume')
    ).toHaveAttribute('aria-invalid', 'true')
    expect(calls.saves).toHaveLength(0)
    expect(calls.submits).toHaveLength(0)
  })

  test('saves, then submits, a complete application', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { calls, user } = await openDraft(fixtures)
    await checkAllDeclarations(user)
    await user.click(screen.getByRole('button', { name: 'Submit application' }))

    await waitFor(() => expect(calls.submits).toHaveLength(1))
    expect(calls.saves).toHaveLength(1)
    expect(calls.submits[0]).toEqual({
      declarationAuthority: true,
      declarationDocumentation: true,
      declarationPublicRecognition: true
    })
    // The page turns read-only once the application is submitted.
    expect(await screen.findByTestId('lcjfip-read-only')).toBeInTheDocument()
    expect(
      screen.getByText('Submitted on 2026-11-18 by Jane Doe.')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument()
  })

  test("shows the server's field errors", async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { user } = await openDraft(fixtures, {
      submit: () =>
        HttpResponse.json(
          {
            errors: [
              {
                fields: ['purchaseDetails.0.pricePremiumTo'],
                message: 'The server rejected this range.'
              }
            ]
          },
          { status: 422 }
        )
    })
    await checkAllDeclarations(user)
    await user.click(screen.getByRole('button', { name: 'Submit application' }))

    expect(
      await screen.findByText('The server rejected this range.')
    ).toBeInTheDocument()
  })

  test('deletes a draft after confirmation', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { calls, user } = await openDraft(fixtures)

    await user.click(
      screen.getByRole('button', { name: 'Delete draft application' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/This cannot be undone/)
    ).toBeInTheDocument()
    expect(calls.deletes).toBe(0)

    await user.click(
      within(dialog).getByRole('button', { name: 'Delete draft application' })
    )
    expect(await screen.findByTestId('landing')).toBeInTheDocument()
    expect(calls.deletes).toBe(1)
  })

  test('creates the application on its first save', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    mockApplicant()
    const calls = mockApi(fixtures.server)
    renderAt(ROUTES.LCJFIP.NEW_APPLICATION, fixtures)
    const user = userEvent.setup()

    expect(
      await screen.findByText('Jane Doe, Supplier - Jet fuel')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Save the application to add comments.')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete draft application' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.creates).toHaveLength(1))
    // The new draft's page opens, with its comment thread.
    const thread = await screen.findByTestId('comment-thread')
    expect(thread).toHaveAttribute('data-entity-type', 'lcjfipApplication')
    expect(thread).toHaveAttribute('data-entity-id', '7')
    expect(thread).toHaveAttribute('data-mode', 'dual')
  })

  test('is read-only once submitted', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    await openDraft(fixtures, { application: submittedApplication() })

    expect(screen.getByTestId('lcjfip-read-only')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: CASH })).toBeDisabled()
    expect(screen.getByTestId('lcjfip-purchase-estimatedVolume')).toBeDisabled()
    // The calculated values grey out with the rest of the form.
    expect(screen.getByTestId('lcjfip-total-estimated-volume')).toBeDisabled()
    expect(
      screen.getByTestId('lcjfip-estimated-incentive-amount')
    ).toBeDisabled()
    // No required markers on a form nobody can edit.
    expect(
      screen.queryByText('indicates a required field')
    ).not.toBeInTheDocument()
    for (const name of [
      'Save',
      'Submit application',
      'Delete draft application'
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  test('has no machine-detectable accessibility violations', async ({
    render,
    query,
    theme,
    localization,
    router,
    i18n,
    server
  }) => {
    const fixtures = {
      render,
      query,
      theme,
      localization,
      router,
      i18n,
      server
    }
    const { view } = await openDraft(fixtures)
    const results = await axe.run(view.container, {
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
