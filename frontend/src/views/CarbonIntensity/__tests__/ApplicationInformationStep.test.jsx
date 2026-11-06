import { test } from '@/tests/utils/fixtures'
import 'react'
import { afterEach, beforeEach, describe, expect, vi } from 'vite-plus/test'
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApplicationInformationStep } from '@/views/CarbonIntensity/components/ApplicationInformationStep'
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

vi.mock('@/hooks/useCIApplication', () => ({
  useGetCIApplicationFacilities: vi.fn(() => ({
    data: [
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
      }
    ],
    isLoading: false,
    isError: false
  })),
  useCreateCIApplicationFacility: vi.fn(() => ({
    mutateAsync: vi.fn(async (facility) => ({
      ...facility,
      fuelProductionFacilityId: 2,
      documents: []
    })),
    isPending: false
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

const selectFacility = async (user) => {
  await user.click(document.getElementById('fuelProductionFacilityId'))
  await user.click(await screen.findByRole('option', { name: 'Test facility' }))
}

describe('ApplicationInformationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

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
    expect(document.getElementById('facilityCity')).toBeInTheDocument()
    expect(document.getElementById('facilityProvinceState')).toBeInTheDocument()
    expect(document.getElementById('facilityCountry')).toBeInTheDocument()
    expect(
      document.getElementById('facilityNameplateCapacity')
    ).toBeInTheDocument()
    expect(
      document.getElementById('facilityNameplateCapacityUnit')
    ).toBeInTheDocument()
    expect(
      document.getElementById('proposedFuelCodeEffectiveDate')
    ).toBeInTheDocument()
    expect(document.getElementById('facilityCity')).toBeRequired()
    expect(document.getElementById('facilityProvinceState')).toBeRequired()
    expect(document.getElementById('facilityCountry')).toBeRequired()
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

  test('creates a facility and applies its details to Step 1', async ({
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

    await user.click(screen.getByTestId('ci-step1-add-facility'))
    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByRole('textbox', {
        name: /carbonIntensity:step1\.facilityName\b/
      }),
      'New production facility'
    )
    await user.type(
      within(dialog).getByRole('textbox', {
        name: /carbonIntensity:step1.city/
      }),
      'New Town'
    )
    await user.type(
      within(dialog).getByRole('textbox', {
        name: /carbonIntensity:step1.provinceState/
      }),
      'New Province'
    )
    await user.type(
      within(dialog).getByRole('textbox', {
        name: /carbonIntensity:step1.country/
      }),
      'New Country'
    )
    await user.type(
      within(dialog).getByRole('textbox', {
        name: /carbonIntensity:step1.facilityNameplate/
      }),
      '2000'
    )
    await user.click(
      within(dialog).getByRole('combobox', {
        name: /carbonIntensity:step1.unitOfMeasure/
      })
    )
    await user.click(await screen.findByRole('option', { name: 'L' }))
    await user.click(
      within(dialog).getByRole('button', {
        name: 'carbonIntensity:step1.saveFacility'
      })
    )

    await waitFor(() => {
      expect(document.getElementById('facilityCity').value).toBe('New Town')
      expect(document.getElementById('facilityCountry').value).toBe(
        'New Country'
      )
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

    fireEvent.change(document.getElementById('proposedFuelCodeEffectiveDate'), {
      target: { value: '2026-09-01' }
    })

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const payload = onSave.mock.calls[0][0]
    expect(payload).toMatchObject({
      fuelProductionFacilityId: 1,
      facilityCity: 'Vancouver',
      facilityProvinceState: 'BC',
      facilityCountry: 'Canada',
      facilityNameplateCapacity: 2500,
      facilityNameplateCapacityUnit: 'kg',
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
    const existing = {
      ciApplicationId: 8,
      fuelProductionFacilityId: 1,
      facilityCity: 'San Martin',
      facilityProvinceState: 'Santa Fe',
      facilityCountry: 'Argentina',
      facilityNameplateCapacity: 1500,
      facilityNameplateCapacityUnit: 'L',
      proposedFuelCodeEffectiveDate: '2026-06-01'
    }
    render(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={existing}
        onDelete={vi.fn()}
      />,
      [query, theme, localization, router]
    )

    expect(document.getElementById('facilityCity').value).toBe('San Martin')
    expect(document.getElementById('facilityProvinceState').value).toBe(
      'Santa Fe'
    )
    expect(document.getElementById('facilityCountry').value).toBe('Argentina')
    expect(document.getElementById('facilityNameplateCapacity').value).toBe(
      '1,500'
    )
    expect(document.getElementById('proposedFuelCodeEffectiveDate').value).toBe(
      '2026-06-01'
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
