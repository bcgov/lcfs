import { test } from '@/tests/utils/fixtures'
import 'react'
import { afterEach, beforeEach, describe, expect, vi } from 'vite-plus/test'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApplicationInformationStep } from '@/views/CarbonIntensity/components/ApplicationInformationStep'
import { useGetCIApplicationFacilities } from '@/hooks/useCIApplication'
import carbonIntensityEn from '@/assets/locales/en/carbonIntensity.json'
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

vi.mock('lodash', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    debounce: (fn) => {
      const wrapped = (...args) => fn(...args)
      wrapped.cancel = vi.fn()
      return wrapped
    }
  }
})

const { defaultFacilities } = vi.hoisted(() => ({
  defaultFacilities: [
    {
      fuelProductionFacilityId: 1,
      name: 'Test facility',
      city: '',
      provinceState: '',
      country: '',
      nameplateCapacity: null,
      nameplateCapacityUnit: '',
      contactName: '',
      contactEmail: '',
      documents: []
    },
    {
      fuelProductionFacilityId: 3,
      name: 'Filled facility',
      city: 'Mock City',
      provinceState: 'Mock Province',
      country: 'Mock Country',
      nameplateCapacity: 4200,
      nameplateCapacityUnit: 'kg',
      contactName: 'Pat Example',
      contactEmail: 'pat@example.com',
      documents: []
    }
  ]
}))

vi.mock('@/components/Documents/DocumentPreviewButton', () => ({
  __esModule: true,
  default: () => (
    <button type="button" data-test="document-preview-button">
      Preview document
    </button>
  )
}))

vi.mock('@/hooks/useCIApplication', () => ({
  useGetCIApplicationFacilities: vi.fn(() => ({
    data: defaultFacilities,
    isLoading: false,
    isError: false
  })),
  useCIFacilityLocationSearch: vi.fn(({ city, province, country } = {}) => {
    if (city?.toLowerCase().includes('coquit')) {
      return { data: ['Coquitlam, British Columbia, Canada'] }
    }
    if (province?.toLowerCase().includes('alb')) {
      return { data: ['Alberta, Canada'] }
    }
    if (country?.toLowerCase().includes('can')) {
      return { data: ['Canada'] }
    }
    return { data: [] }
  })
}))

const baseProps = {
  ciApplication: undefined,
  organization: {
    organizationId: 1,
    name: 'Fuel Producer Ltd.',
    addressLine: '697 Sarmiento, San Martin, Santa Fe, Argentina',
    email: 'Zimmerman@fuelproducerltd.ar',
    phone: '+54 9 11 1234-5678'
  },
  unitsOfMeasure: ['L', 'kg']
}

const selectUnit = async (user, unit = 'kg') => {
  await user.click(document.getElementById('facilityNameplateCapacityUnit'))
  await user.click(await screen.findByRole('option', { name: unit }))
}

// New applications with existing org facilities start in select mode, so
// tests that work with the fields open the blank form via "Add new".
const openNewFacilityForm = () => {
  fireEvent.click(screen.getByTestId('ci-step1-add-facility'))
}

const selectFacility = async (user, name = 'Test facility') => {
  await user.click(document.getElementById('fuelProductionFacilityId'))
  await user.click(await screen.findByRole('option', { name }))
}

const savedFacilityApplication = {
  ciApplicationId: 8,
  fuelProductionFacilityId: 1,
  fuelProductionFacility: {
    fuelProductionFacilityId: 1,
    name: 'Test facility',
    contactName: 'Pat Example',
    contactEmail: 'pat@example.com',
    documents: []
  },
  facilityCity: 'San Martin',
  facilityProvinceState: 'Santa Fe',
  facilityCountry: 'Argentina',
  facilityNameplateCapacity: 1500,
  facilityNameplateCapacityUnit: 'L',
  proposedFuelCodeEffectiveDate: '2026-06-01'
}

const fillContact = async (user) => {
  await user.type(document.getElementById('facilityContactName'), 'Pat Example')
  await user.type(
    document.getElementById('facilityContactEmail'),
    'pat@example.com'
  )
}

describe('ApplicationInformationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGetCIApplicationFacilities.mockReturnValue({
      data: defaultFacilities,
      isLoading: false,
      isError: false
    })
  })
  afterEach(cleanup)

  test('preserves dirty form fields across document-only application refetches', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const application = {
      ciApplicationId: 99,
      facilityCity: 'Original city',
      facilityNameplateCapacity: 100,
      documents: []
    }
    const { rerender } = render(
      <ApplicationInformationStep {...baseProps} ciApplication={application} />,
      [query, theme, localization, router]
    )
    openNewFacilityForm()
    fireEvent.change(document.getElementById('facilityCity'), {
      target: { value: 'Unsaved city' }
    })
    fireEvent.change(document.getElementById('facilityNameplateCapacity'), {
      target: { value: '250' }
    })

    rerender(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={{
          ...application,
          documents: [{ documentId: 7, fileName: 'uploaded.pdf' }]
        }}
      />
    )

    expect(document.getElementById('facilityCity')).toHaveValue('Unsaved city')
    expect(document.getElementById('facilityNameplateCapacity')).toHaveValue(
      '250'
    )

    rerender(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={{
          ...application,
          ciApplicationId: 100,
          facilityCity: 'Next city'
        }}
      />
    )
    // A different application resets the section to the default (select) mode.
    expect(screen.getByTestId('ci-step1-add-facility')).toBeInTheDocument()
    expect(document.getElementById('facilityCity')).toBeNull()
  })

  test('renders the organization summary block when provided', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByText('Fuel Producer Ltd.')).toBeInTheDocument()
    expect(
      screen.getByText('697 Sarmiento, San Martin, Santa Fe, Argentina')
    ).toBeInTheDocument()
    expect(screen.getByText('Zimmerman@fuelproducerltd.ar')).toBeInTheDocument()
  })

  test('renders all Step 1 form fields', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    openNewFacilityForm()
    expect(document.getElementById('facilityName')).toBeInTheDocument()
    expect(document.getElementById('facilityCity')).toBeInTheDocument()
    expect(document.getElementById('facilityProvinceState')).toBeInTheDocument()
    expect(document.getElementById('facilityCountry')).toBeInTheDocument()
    expect(
      document.getElementById('facilityNameplateCapacity')
    ).toBeInTheDocument()
    expect(
      document.getElementById('facilityNameplateCapacityUnit')
    ).toBeInTheDocument()
    expect(document.getElementById('facilityContactName')).toBeInTheDocument()
    expect(document.getElementById('facilityContactEmail')).toBeInTheDocument()
    expect(
      document.getElementById('proposedFuelCodeEffectiveDate')
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('ci-step1-process-flow-upload')
    ).toBeInTheDocument()
    expect(document.getElementById('facilityName')).toBeRequired()
    expect(document.getElementById('facilityCity')).toBeRequired()
    expect(document.getElementById('facilityProvinceState')).toBeRequired()
    expect(document.getElementById('facilityCountry')).toBeRequired()
    expect(document.getElementById('facilityContactName')).toBeRequired()
    expect(document.getElementById('facilityContactEmail')).toBeRequired()
  })

  test('renders the Save & proceed button and no Delete button on add', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByTestId('ci-step1-save-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('ci-step1-delete-btn')).not.toBeInTheDocument()
  })

  test('renders the Delete button when editing an existing application AND onDelete is wired', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={{ ciApplicationId: 5, facilityCountry: 'Argentina' }}
        onDelete={vi.fn()}
      />,
      [query, theme, localization, router]
    )
    expect(screen.getByTestId('ci-step1-delete-btn')).toBeInTheDocument()
  })

  test('starts in select mode when the organization has facilities', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(
      document.getElementById('fuelProductionFacilityId')
    ).toBeInTheDocument()
    expect(screen.getByTestId('ci-step1-add-facility')).toBeInTheDocument()
    expect(document.getElementById('facilityName')).toBeNull()
    expect(screen.queryByTestId('ci-step1-facility-summary')).toBeNull()
  })

  test('starts in the blank form when the organization has no facilities', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    useGetCIApplicationFacilities.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false
    })
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(document.getElementById('fuelProductionFacilityId')).toBeNull()
    expect(document.getElementById('facilityName')).toBeInTheDocument()
  })

  test('selecting a complete facility stays in select mode and saves its id', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

    await selectFacility(user, 'Filled facility — Mock City')

    expect(document.getElementById('facilityName')).toBeNull()
    expect(screen.queryByTestId('ci-step1-facility-summary')).toBeNull()
    expect(
      document.getElementById('fuelProductionFacilityId')
    ).toHaveTextContent('Filled facility')

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      fuelProductionFacilityId: 3,
      facilityName: 'Filled facility',
      facilityCity: 'Mock City',
      facilityNameplateCapacity: 4200,
      facilityNameplateCapacityUnit: 'kg',
      facilityContactName: 'Pat Example',
      facilityContactEmail: 'pat@example.com'
    })
  })

  test('selecting an incomplete facility opens the pre-filled form', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])

    await selectFacility(user, 'Test facility')

    await waitFor(() =>
      expect(document.getElementById('facilityName')).toBeInTheDocument()
    )
    expect(document.getElementById('facilityName').value).toBe('Test facility')
    expect(document.getElementById('facilityCity').value).toBe('')
    expect(screen.getByTestId('ci-step1-process-flow-upload')).toBeEnabled()
  })

  test('saving in select mode without a selection shows a facility error', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() =>
      expect(
        screen.getByText('carbonIntensity:step1.validation.facilityRequired')
      ).toBeInTheDocument()
    )
    expect(onSave).not.toHaveBeenCalled()
    expect(document.getElementById('facilityName')).toBeNull()
  })

  test('shows the saved facility as a summary with edit pencils and no upload button', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={savedFacilityApplication}
      />,
      [query, theme, localization, router]
    )

    const summary = screen.getByTestId('ci-step1-facility-summary')
    expect(summary).toHaveTextContent('Test facility')
    expect(summary).toHaveTextContent('San Martin, Santa Fe, Argentina')
    expect(summary).toHaveTextContent('1,500 L')
    expect(summary).toHaveTextContent('Pat Example')
    expect(summary).toHaveTextContent('pat@example.com')
    expect(screen.getByTestId('ci-step1-edit-facility')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step1-add-facility')).toBeInTheDocument()
    expect(
      screen.queryByText('carbonIntensity:step1.processFlowDiagram')
    ).toBeNull()
    expect(document.getElementById('facilityCity')).toBeNull()
  })

  test('"Add new fuel production facility" clears the saved facility and opens a blank form', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const user = userEvent.setup()
    render(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={savedFacilityApplication}
      />,
      [query, theme, localization, router]
    )

    await user.click(screen.getByTestId('ci-step1-add-facility'))

    await waitFor(() =>
      expect(document.getElementById('facilityName').value).toBe('')
    )
    expect(document.getElementById('facilityCity').value).toBe('')
    expect(document.getElementById('facilityContactName').value).toBe('')
    expect(screen.queryByTestId('ci-step1-facility-summary')).toBeNull()
  })

  test('returns to the summary after a successful save even if nothing changed', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn(async () => true)
    const user = userEvent.setup()
    render(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={savedFacilityApplication}
        onSave={onSave}
      />,
      [query, theme, localization, router]
    )

    await user.click(screen.getByTestId('ci-step1-edit-facility'))
    await waitFor(() =>
      expect(document.getElementById('facilityName')).toBeInTheDocument()
    )

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        screen.getByTestId('ci-step1-facility-summary')
      ).toBeInTheDocument()
    )
    expect(document.getElementById('facilityName')).toBeNull()
  })

  test('stays in the form when the save fails', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn(async () => false)
    const user = userEvent.setup()
    render(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={savedFacilityApplication}
        onSave={onSave}
      />,
      [query, theme, localization, router]
    )

    await user.click(screen.getByTestId('ci-step1-edit-facility'))
    await waitFor(() =>
      expect(document.getElementById('facilityName')).toBeInTheDocument()
    )

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(document.getElementById('facilityName')).toBeInTheDocument()
    expect(screen.queryByTestId('ci-step1-facility-summary')).toBeNull()
  })

  describe('uploaded process flow diagram placement', () => {
    const withDocument = {
      ...savedFacilityApplication,
      fuelProductionFacility: {
        ...savedFacilityApplication.fuelProductionFacility,
        documents: [{ documentId: 7, fileName: 'process-flow.pdf' }]
      }
    }
    const isBefore = (a, b) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    test('summary lists the file directly above the Add new button with a replace pencil', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ApplicationInformationStep
          {...baseProps}
          ciApplication={withDocument}
        />,
        [query, theme, localization, router]
      )

      const docs = screen.getByTestId('ci-step1-facility-documents')
      expect(docs).toHaveTextContent('process-flow.pdf')
      expect(
        screen.getByTestId('ci-step1-process-flow-replace')
      ).toBeInTheDocument()
      const summary = screen.getByTestId('ci-step1-facility-summary')
      const addNew = screen.getByTestId('ci-step1-add-facility')
      expect(isBefore(summary, docs)).toBe(true)
      expect(isBefore(docs, addNew)).toBe(true)
    })

    test('form shows the file directly above the Upload button without a replace pencil', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const user = userEvent.setup()
      render(
        <ApplicationInformationStep
          {...baseProps}
          ciApplication={withDocument}
        />,
        [query, theme, localization, router]
      )
      await user.click(screen.getByTestId('ci-step1-edit-facility'))

      const docs = await screen.findByTestId('ci-step1-facility-documents')
      const upload = screen.getByTestId('ci-step1-process-flow-upload')
      expect(docs).toHaveTextContent('process-flow.pdf')
      expect(screen.queryByTestId('ci-step1-process-flow-replace')).toBeNull()
      expect(isBefore(docs, upload)).toBe(true)
      expect(
        isBefore(document.getElementById('facilityContactEmail'), docs)
      ).toBe(true)
    })
  })

  test('typing a new facility name saves without an existing facility id', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])
    openNewFacilityForm()

    await user.type(
      document.getElementById('facilityName'),
      'New production facility'
    )
    await user.type(document.getElementById('facilityCity'), 'New Town')
    await user.type(
      document.getElementById('facilityProvinceState'),
      'New Province'
    )
    await user.type(document.getElementById('facilityCountry'), 'New Country')
    await user.type(
      document.getElementById('facilityNameplateCapacity'),
      '2000'
    )
    await selectUnit(user, 'L')
    await fillContact(user)

    // Upload needs a saved facility to attach documents to.
    expect(screen.getByTestId('ci-step1-process-flow-upload')).toBeDisabled()

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      fuelProductionFacilityId: null,
      facilityName: 'New production facility',
      facilityCity: 'New Town',
      facilityProvinceState: 'New Province',
      facilityCountry: 'New Country',
      facilityNameplateCapacity: 2000,
      facilityNameplateCapacityUnit: 'L',
      facilityContactName: 'Pat Example',
      facilityContactEmail: 'pat@example.com'
    })
  }, 15000)

  test('blocks submission when required fields are missing', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

    await selectFacility(user)
    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => {
      expect(
        screen.getByText('carbonIntensity:step1.validation.countryRequired')
      ).toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  test('blocks submission when city or province/state are missing', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

    await selectFacility(user)
    await user.click(document.getElementById('facilityCountry'))
    await user.type(document.getElementById('facilityCountry'), 'Canada')
    await user.type(
      document.getElementById('facilityNameplateCapacity'),
      '2500'
    )
    await selectUnit(user)

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => {
      expect(
        screen.getByText('carbonIntensity:step1.validation.cityRequired')
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'carbonIntensity:step1.validation.provinceStateRequired'
        )
      ).toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  test('rejects non-positive capacity values', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

    await selectFacility(user)
    await user.click(document.getElementById('facilityCountry'))
    await user.type(document.getElementById('facilityCountry'), 'Argentina')
    const capacity = document.getElementById('facilityNameplateCapacity')
    await user.clear(capacity)
    await user.type(capacity, '0')

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => {
      expect(
        screen.getByText('carbonIntensity:step1.validation.capacityPositive')
      ).toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  test('calls onSave with normalized payload when the form is valid', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

    await selectFacility(user)
    await user.click(document.getElementById('facilityCity'))
    await user.type(document.getElementById('facilityCity'), 'Vancouver')
    await user.click(document.getElementById('facilityProvinceState'))
    await user.type(document.getElementById('facilityProvinceState'), 'BC')
    await user.click(document.getElementById('facilityCountry'))
    await user.type(document.getElementById('facilityCountry'), 'Canada')
    await user.type(
      document.getElementById('facilityNameplateCapacity'),
      '2500'
    )
    await selectUnit(user)
    await fillContact(user)

    fireEvent.change(document.getElementById('proposedFuelCodeEffectiveDate'), {
      target: { value: '2026-09-01' }
    })

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = onSave.mock.calls[0][0]
    expect(payload).toMatchObject({
      fuelProductionFacilityId: 1,
      facilityName: 'Test facility',
      facilityCity: 'Vancouver',
      facilityProvinceState: 'BC',
      facilityCountry: 'Canada',
      facilityNameplateCapacity: 2500,
      facilityNameplateCapacityUnit: 'kg',
      facilityContactName: 'Pat Example',
      facilityContactEmail: 'pat@example.com',
      proposedFuelCodeEffectiveDate: '2026-09-01'
    })
  })

  test('shows API suggestions and auto-populates on select', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    openNewFacilityForm()

    await user.click(document.getElementById('facilityCity'))
    await user.type(document.getElementById('facilityCity'), 'coquit')

    const option = await screen.findByRole('option', {
      name: 'Coquitlam, British Columbia, Canada'
    })
    await user.click(option)

    await waitFor(() => {
      expect(document.getElementById('facilityCity').value).toBe('Coquitlam')
      expect(document.getElementById('facilityProvinceState').value).toBe(
        'British Columbia'
      )
      expect(document.getElementById('facilityCountry').value).toBe('Canada')
    })
  })

  test('province autocomplete works without entering city first', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    openNewFacilityForm()

    await user.click(document.getElementById('facilityProvinceState'))
    await user.type(document.getElementById('facilityProvinceState'), 'alb')

    const option = await screen.findByRole('option', {
      name: 'Alberta, Canada'
    })
    await user.click(option)

    await waitFor(() => {
      expect(document.getElementById('facilityCity').value).toBe('')
      expect(document.getElementById('facilityProvinceState').value).toBe(
        'Alberta'
      )
      expect(document.getElementById('facilityCountry').value).toBe('Canada')
    })
  })

  test('country autocomplete works without entering city first', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    openNewFacilityForm()

    await user.click(document.getElementById('facilityCountry'))
    await user.type(document.getElementById('facilityCountry'), 'can')

    const option = await screen.findByRole('option', { name: 'Canada' })
    await user.click(option)

    await waitFor(() => {
      expect(document.getElementById('facilityCity').value).toBe('')
      expect(document.getElementById('facilityProvinceState').value).toBe('')
      expect(document.getElementById('facilityCountry').value).toBe('Canada')
    })
  })

  test('disables browser autofill attributes on location fields', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ApplicationInformationStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    openNewFacilityForm()
    expect(document.getElementById('facilityCity')).toHaveAttribute(
      'autocomplete',
      'lcfs-no-autofill-facilityCity'
    )
    expect(document.getElementById('facilityProvinceState')).toHaveAttribute(
      'autocomplete',
      'lcfs-no-autofill-facilityProvinceState'
    )
    expect(document.getElementById('facilityCountry')).toHaveAttribute(
      'autocomplete',
      'lcfs-no-autofill-facilityCountry'
    )
  })

  test('pre-populates fields from an existing application', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={savedFacilityApplication}
        onDelete={vi.fn()}
      />,
      [query, theme, localization, router]
    )

    const summary = screen.getByTestId('ci-step1-facility-summary')
    expect(summary).toHaveTextContent('Test facility')
    expect(summary).toHaveTextContent('San Martin, Santa Fe, Argentina')
    expect(summary).toHaveTextContent('1,500 L')
    expect(summary).toHaveTextContent('pat@example.com')
    expect(document.getElementById('proposedFuelCodeEffectiveDate').value).toBe(
      '2026-06-01'
    )

    fireEvent.click(screen.getByTestId('ci-step1-edit-facility'))

    expect(document.getElementById('facilityName').value).toBe('Test facility')
    expect(document.getElementById('facilityCity').value).toBe('San Martin')
    expect(document.getElementById('facilityProvinceState').value).toBe(
      'Santa Fe'
    )
    expect(document.getElementById('facilityCountry').value).toBe('Argentina')
    expect(document.getElementById('facilityNameplateCapacity').value).toBe(
      '1,500'
    )
    expect(document.getElementById('facilityContactName').value).toBe(
      'Pat Example'
    )
  })

  test('disables the save button when readOnly is true', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ApplicationInformationStep {...baseProps} readOnly />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByTestId('ci-step1-save-btn')).toBeDisabled()
  })

  test('disables the save button while isSaving is true', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<ApplicationInformationStep {...baseProps} isSaving />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByTestId('ci-step1-save-btn')).toBeDisabled()
  })

  describe('proposed effective date notice (#5225)', () => {
    test('shows the notice above the effective date field and links it to the input', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ApplicationInformationStep {...baseProps} showEffectiveDateNotice />,
        [query, theme, localization, router]
      )

      const notice = screen.getByRole('note')
      expect(notice).toHaveTextContent(
        'carbonIntensity:step1.proposedFuelCodeEffectiveNotice'
      )
      const input = document.getElementById('proposedFuelCodeEffectiveDate')
      expect(
        notice.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      expect(input).toHaveAttribute('aria-describedby', notice.id)
      expect(input).toHaveAccessibleDescription(
        'carbonIntensity:step1.proposedFuelCodeEffectiveNotice'
      )
    })

    test('keeps the notice visible when the step is read-only', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(
        <ApplicationInformationStep
          {...baseProps}
          showEffectiveDateNotice
          readOnly
        />,
        [query, theme, localization, router]
      )
      expect(screen.getByRole('note')).toBeInTheDocument()
    })

    test('hides the notice unless requested', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      render(<ApplicationInformationStep {...baseProps} />, [
        query,
        theme,
        localization,
        router
      ])
      expect(screen.queryByRole('note')).not.toBeInTheDocument()
      expect(
        document.getElementById('proposedFuelCodeEffectiveDate')
      ).not.toHaveAttribute('aria-describedby')
    })

    it('uses the approved wording', () => {
      expect(carbonIntensityEn.step1.proposedFuelCodeEffectiveNotice).toBe(
        'Effective dates more than six months after the application date require additional supporting information to confirm that the information provided remains accurate and applicable at the requested effective date.'
      )
    })
  })
})
