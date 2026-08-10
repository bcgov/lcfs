import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ApplicationInformationStep } from '@/views/CarbonIntensity/components/ApplicationInformationStep'
import { wrapper } from '@/tests/utils/wrapper'

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

describe('ApplicationInformationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('renders the organization summary block when provided', () => {
    render(<ApplicationInformationStep {...baseProps} />, { wrapper })
    expect(screen.getByText('Fuel Producer Ltd.')).toBeInTheDocument()
    expect(
      screen.getByText('697 Sarmiento, San Martin, Santa Fe, Argentina')
    ).toBeInTheDocument()
    expect(screen.getByText('Zimmerman@fuelproducerltd.ar')).toBeInTheDocument()
  })

  it('renders all Step 1 form fields', () => {
    render(<ApplicationInformationStep {...baseProps} />, { wrapper })
    expect(document.getElementById('facilityCity')).toBeInTheDocument()
    expect(document.getElementById('facilityProvinceState')).toBeInTheDocument()
    expect(document.getElementById('facilityCountry')).toBeInTheDocument()
    expect(document.getElementById('facilityNameplateCapacity')).toBeInTheDocument()
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

  it('renders the Save & proceed button and no Delete button on add', () => {
    render(<ApplicationInformationStep {...baseProps} />, { wrapper })
    expect(screen.getByTestId('ci-step1-save-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('ci-step1-delete-btn')).not.toBeInTheDocument()
  })

  it('renders the Delete button when editing an existing application AND onDelete is wired', () => {
    render(
      <ApplicationInformationStep
        {...baseProps}
        ciApplication={{ ciApplicationId: 5, facilityCountry: 'Argentina' }}
        onDelete={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByTestId('ci-step1-delete-btn')).toBeInTheDocument()
  })

  it('blocks submission when required fields are missing', async () => {
    const onSave = vi.fn()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, {
      wrapper
    })

    fireEvent.click(screen.getByTestId('ci-step1-save-btn'))

    await waitFor(() => {
      expect(
        screen.getByText('carbonIntensity:step1.validation.countryRequired')
      ).toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('blocks submission when city or province/state are missing', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, {
      wrapper
    })

    await user.click(document.getElementById('facilityCountry'))
    await user.type(document.getElementById('facilityCountry'), 'Canada')
    await user.type(document.getElementById('facilityNameplateCapacity'), '2500')
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

  it('rejects non-positive capacity values', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, {
      wrapper
    })

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

  it('calls onSave with normalized payload when the form is valid', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} onSave={onSave} />, {
      wrapper
    })

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
      facilityCity: 'Vancouver',
      facilityProvinceState: 'BC',
      facilityCountry: 'Canada',
      facilityNameplateCapacity: 2500,
      facilityNameplateCapacityUnit: 'kg',
      proposedFuelCodeEffectiveDate: '2026-09-01'
    })
  })

  it('shows API suggestions and auto-populates on select', async () => {
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} />, { wrapper })

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

  it('province autocomplete works without entering city first', async () => {
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} />, { wrapper })

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

  it('country autocomplete works without entering city first', async () => {
    const user = userEvent.setup()
    render(<ApplicationInformationStep {...baseProps} />, { wrapper })

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

  it('disables browser autofill attributes on location fields', () => {
    render(<ApplicationInformationStep {...baseProps} />, { wrapper })
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

  it('pre-populates fields from an existing application', () => {
    const existing = {
      ciApplicationId: 8,
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
      { wrapper }
    )

    expect(document.getElementById('facilityCity').value).toBe('San Martin')
    expect(document.getElementById('facilityProvinceState').value).toBe('Santa Fe')
    expect(document.getElementById('facilityCountry').value).toBe('Argentina')
    expect(document.getElementById('facilityNameplateCapacity').value).toBe('1,500')
    expect(document.getElementById('proposedFuelCodeEffectiveDate').value).toBe(
      '2026-06-01'
    )
  })

  it('disables the save button when readOnly is true', () => {
    render(<ApplicationInformationStep {...baseProps} readOnly />, { wrapper })
    expect(screen.getByTestId('ci-step1-save-btn')).toBeDisabled()
  })

  it('disables the save button while isSaving is true', () => {
    render(<ApplicationInformationStep {...baseProps} isSaving />, { wrapper })
    expect(screen.getByTestId('ci-step1-save-btn')).toBeDisabled()
  })
})
