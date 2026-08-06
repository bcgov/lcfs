import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'

import { SignAndSubmitStep } from '@/views/CarbonIntensity/components/SignAndSubmitStep'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

const baseProps = {
  ciApplication: { ciApplicationId: 10 },
  currentUser: {
    firstName: 'Jonathan',
    lastName: 'Zimmerman',
    title: 'Production Manager',
    email: 'jzimmerman@fuelproducerltd.ar'
  }
}

describe('SignAndSubmitStep', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('renders all three declarations and signing-authority info', () => {
    render(<SignAndSubmitStep {...baseProps} />, { wrapper })
    expect(screen.getByTestId('ci-step4-decl-1')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step4-decl-2')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step4-decl-3')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step4-signing-authority-block').textContent).toContain(
      'Jonathan Zimmerman'
    )
    expect(screen.getByTestId('ci-step4-signing-authority-block').textContent).toContain(
      'jzimmerman@fuelproducerltd.ar'
    )
  })

  it('disables submission until all required declarations are checked', () => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, { wrapper })

    // Submit is gated on the three required declarations (ticket #4536).
    expect(screen.getByTestId('ci-step4-submit-btn')).toBeDisabled()
    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))
    expect(onSave).not.toHaveBeenCalled()

    // Checking only some of the required declarations keeps it disabled.
    fireEvent.click(screen.getByTestId('ci-step4-decl-1'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-2'))
    expect(screen.getByTestId('ci-step4-submit-btn')).toBeDisabled()

    // All three required declarations enable the button.
    fireEvent.click(screen.getByTestId('ci-step4-decl-3'))
    expect(screen.getByTestId('ci-step4-submit-btn')).toBeEnabled()
  })

  it('calls onSave with the correct payload when all declarations are checked', async () => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, { wrapper })

    fireEvent.click(screen.getByTestId('ci-step4-decl-1'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-2'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-3'))
    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      declarationInformationTrue: true,
      declarationResponse8Weeks: true,
      declarationSection206: true,
      consultantConsent: false,
      consultantName: null,
      consultantCompany: null,
      consultantEmail: null
    })
  })

  it('exposes consultant inputs only when consent is checked', () => {
    render(<SignAndSubmitStep {...baseProps} />, { wrapper })
    expect(screen.queryByTestId('ci-step4-consultant-name')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ci-step4-consultant-consent'))
    expect(screen.getByTestId('ci-step4-consultant-name')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step4-consultant-company')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step4-consultant-email')).toBeInTheDocument()
  })

  it('rejects submission when consultant consent is on but fields are empty', async () => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, { wrapper })

    fireEvent.click(screen.getByTestId('ci-step4-decl-1'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-2'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-3'))
    fireEvent.click(screen.getByTestId('ci-step4-consultant-consent'))
    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))

    await waitFor(() => {
      expect(
        screen.getByText('carbonIntensity:step4.validation.consultantNameRequired')
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'carbonIntensity:step4.validation.consultantCompanyRequired'
        )
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'carbonIntensity:step4.validation.consultantEmailRequired'
        )
      ).toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects an invalid consultant email', async () => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, { wrapper })
    fireEvent.click(screen.getByTestId('ci-step4-decl-1'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-2'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-3'))
    fireEvent.click(screen.getByTestId('ci-step4-consultant-consent'))

    fireEvent.change(screen.getByTestId('ci-step4-consultant-name'), {
      target: { value: 'Sam Anderson' }
    })
    fireEvent.change(screen.getByTestId('ci-step4-consultant-company'), {
      target: { value: 'Anderson Fuel Consultants' }
    })
    fireEvent.change(screen.getByTestId('ci-step4-consultant-email'), {
      target: { value: 'not-an-email' }
    })

    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))
    await waitFor(() => {
      expect(
        screen.getByText(
          'carbonIntensity:step4.validation.consultantEmailInvalid'
        )
      ).toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('passes consultant info through to onSave when consented and valid', async () => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, { wrapper })

    fireEvent.click(screen.getByTestId('ci-step4-decl-1'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-2'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-3'))
    fireEvent.click(screen.getByTestId('ci-step4-consultant-consent'))

    fireEvent.change(screen.getByTestId('ci-step4-consultant-name'), {
      target: { value: 'Sam Anderson' }
    })
    fireEvent.change(screen.getByTestId('ci-step4-consultant-company'), {
      target: { value: 'Anderson Fuel Consultants' }
    })
    fireEvent.change(screen.getByTestId('ci-step4-consultant-email'), {
      target: { value: 'sam.anderson@afc.ar' }
    })
    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      consultantConsent: true,
      consultantName: 'Sam Anderson',
      consultantCompany: 'Anderson Fuel Consultants',
      consultantEmail: 'sam.anderson@afc.ar'
    })
  })

  it('disables submit when readOnly is true', () => {
    render(<SignAndSubmitStep {...baseProps} readOnly />, { wrapper })
    expect(screen.getByTestId('ci-step4-submit-btn')).toBeDisabled()
  })

  it('disables submit when isSaving is true', () => {
    render(<SignAndSubmitStep {...baseProps} isSaving />, { wrapper })
    expect(screen.getByTestId('ci-step4-submit-btn')).toBeDisabled()
  })

  it('renders the delete button when onDelete is wired', () => {
    render(<SignAndSubmitStep {...baseProps} onDelete={vi.fn()} />, { wrapper })
    expect(screen.getByTestId('ci-step4-delete-btn')).toBeInTheDocument()
  })

  // --- Consultant auto-save (#4772) -------------------------------------
  describe('consultant auto-save', () => {
    const openConsultantBlock = () => {
      fireEvent.click(screen.getByTestId('ci-step4-consultant-consent'))
    }

    it('saves a consultant field on blur', async () => {
      const onAutoSave = vi.fn()
      render(<SignAndSubmitStep {...baseProps} onAutoSave={onAutoSave} />, {
        wrapper
      })
      openConsultantBlock()

      const name = screen.getByTestId('ci-step4-consultant-name')
      fireEvent.change(name, { target: { value: 'Sam Anderson' } })
      fireEvent.blur(name)

      await waitFor(() => expect(onAutoSave).toHaveBeenCalledTimes(1))
      expect(onAutoSave.mock.calls[0][0]).toMatchObject({
        consultantConsent: true,
        consultantName: 'Sam Anderson',
        consultantCompany: null,
        consultantEmail: null
      })
    })

    it('does not re-save when a blur changed nothing', async () => {
      const onAutoSave = vi.fn()
      render(<SignAndSubmitStep {...baseProps} onAutoSave={onAutoSave} />, {
        wrapper
      })
      openConsultantBlock()

      const name = screen.getByTestId('ci-step4-consultant-name')
      fireEvent.change(name, { target: { value: 'Sam Anderson' } })
      fireEvent.blur(name)
      await waitFor(() => expect(onAutoSave).toHaveBeenCalledTimes(1))

      // Blurring again without editing must not fire a second toast.
      fireEvent.blur(name)
      fireEvent.blur(screen.getByTestId('ci-step4-consultant-company'))
      expect(onAutoSave).toHaveBeenCalledTimes(1)
    })

    it('clears stored details when consent is withdrawn', async () => {
      const onAutoSave = vi.fn()
      render(
        <SignAndSubmitStep
          {...baseProps}
          ciApplication={{
            ciApplicationId: 10,
            consultantName: 'Sam Anderson',
            consultantCompany: 'Anderson Fuel Consultants',
            consultantEmail: 'sam.anderson@afc.ar'
          }}
          onAutoSave={onAutoSave}
        />,
        { wrapper }
      )

      // Consent is derived from stored values, so the box starts ticked.
      fireEvent.click(screen.getByTestId('ci-step4-consultant-consent'))

      await waitFor(() => expect(onAutoSave).toHaveBeenCalledTimes(1))
      expect(onAutoSave.mock.calls[0][0]).toMatchObject({
        consultantConsent: false,
        consultantName: null,
        consultantCompany: null,
        consultantEmail: null
      })
    })

    it('restores saved consultant details when a draft is reopened', () => {
      render(
        <SignAndSubmitStep
          {...baseProps}
          ciApplication={{
            ciApplicationId: 10,
            consultantName: 'Sam Anderson',
            consultantCompany: 'Anderson Fuel Consultants',
            consultantEmail: 'sam.anderson@afc.ar'
          }}
          onAutoSave={vi.fn()}
        />,
        { wrapper }
      )

      // The block must be visible, not hidden behind an unticked box.
      expect(screen.getByTestId('ci-step4-consultant-consent')).toBeChecked()
      expect(screen.getByTestId('ci-step4-consultant-name')).toHaveValue(
        'Sam Anderson'
      )
      expect(screen.getByTestId('ci-step4-consultant-email')).toHaveValue(
        'sam.anderson@afc.ar'
      )
    })

    it('does not auto-save before Step 1 has created the draft', () => {
      const onAutoSave = vi.fn()
      render(
        <SignAndSubmitStep
          {...baseProps}
          ciApplication={undefined}
          onAutoSave={onAutoSave}
        />,
        { wrapper }
      )
      openConsultantBlock()

      const name = screen.getByTestId('ci-step4-consultant-name')
      fireEvent.change(name, { target: { value: 'Sam Anderson' } })
      fireEvent.blur(name)

      expect(onAutoSave).not.toHaveBeenCalled()
    })

    it('does not auto-save when readOnly', () => {
      const onAutoSave = vi.fn()
      render(
        <SignAndSubmitStep
          {...baseProps}
          ciApplication={{
            ciApplicationId: 10,
            consultantName: 'Sam Anderson'
          }}
          onAutoSave={onAutoSave}
          readOnly
        />,
        { wrapper }
      )

      fireEvent.blur(screen.getByTestId('ci-step4-consultant-name'))
      expect(onAutoSave).not.toHaveBeenCalled()
    })
  })
})
