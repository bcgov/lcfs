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

const baseProps = {
  ciApplication: undefined,
  organization: {
    organizationId: 1,
    name: 'Fuel Producer Ltd.',
    addressLine: '697 Sarmiento, San Martin, Santa Fe, Argentina',
    email: 'Zimmerman@fuelproducerltd.ar',
    phone: '+54 9 11 1234-5678'
  },
  unitsOfMeasure: [
    { uomId: 1, name: 'Litres' },
    { uomId: 2, name: 'Kilograms' }
  ]
}

describe('ApplicationInformationStep', () => {
  beforeEach(() => vi.clearAllMocks())
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
      document.getElementById('facilityNameplateCapacityUnitId')
    ).toBeInTheDocument()
    expect(
      document.getElementById('proposedFuelCodeEffectiveDate')
    ).toBeInTheDocument()
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

    // i18n mock returns keys as-is; we assert the validation key surfaces
    await waitFor(() => {
      expect(
        screen.getByText('carbonIntensity:step1.validation.countryRequired')
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

    await user.type(document.getElementById('facilityCity'), 'Vancouver')
    await user.type(document.getElementById('facilityProvinceState'), 'BC')
    await user.type(document.getElementById('facilityCountry'), 'Canada')
    await user.type(
      document.getElementById('facilityNameplateCapacity'),
      '2500'
    )

    // MUI Select: open the listbox and click the desired option.
    const combobox = screen.getByRole('combobox')
    await user.click(combobox)
    const option = await screen.findByRole('option', { name: 'Kilograms' })
    await user.click(option)

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
      facilityNameplateCapacityUnitId: 2,
      proposedFuelCodeEffectiveDate: '2026-09-01'
    })
  })

  it('pre-populates fields from an existing application', () => {
    const existing = {
      ciApplicationId: 8,
      facilityCity: 'San Martin',
      facilityProvinceState: 'Santa Fe',
      facilityCountry: 'Argentina',
      facilityNameplateCapacity: 1500,
      facilityNameplateCapacityUnitId: 1,
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
    // Nameplate capacity is rendered with thousands separators.
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
