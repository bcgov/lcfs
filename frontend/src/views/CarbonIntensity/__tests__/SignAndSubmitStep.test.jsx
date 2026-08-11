import React from 'react'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

import { SignAndSubmitStep } from '@/views/CarbonIntensity/components/SignAndSubmitStep'
import { test } from '@/tests/utils/fixtures'

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

  test('renders all three declarations and signing-authority info', ({
    render,
    theme,
    router
  }) => {
    render(<SignAndSubmitStep {...baseProps} />, [theme, router])
    expect(screen.getByTestId('ci-step4-decl-1')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step4-decl-2')).toBeInTheDocument()
    expect(screen.getByTestId('ci-step4-decl-3')).toBeInTheDocument()
    expect(
      screen.getByTestId('ci-step4-signing-authority-block').textContent
    ).toContain('Jonathan Zimmerman')
    expect(
      screen.getByTestId('ci-step4-signing-authority-block').textContent
    ).toContain('jzimmerman@fuelproducerltd.ar')
  })

  test('disables submission until all required declarations are checked', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

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

  test('calls onSave with the correct payload when all declarations are checked', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

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

  test('exposes consultant inputs only when consent is checked', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<SignAndSubmitStep {...baseProps} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(
      screen.queryByTestId('ci-step4-consultant-name')
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('ci-step4-consultant-consent'))
    expect(screen.getByTestId('ci-step4-consultant-name')).toBeInTheDocument()
    expect(
      screen.getByTestId('ci-step4-consultant-company')
    ).toBeInTheDocument()
    expect(screen.getByTestId('ci-step4-consultant-email')).toBeInTheDocument()
  })

  test('rejects submission when consultant consent is on but fields are empty', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

    fireEvent.click(screen.getByTestId('ci-step4-decl-1'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-2'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-3'))
    fireEvent.click(screen.getByTestId('ci-step4-consultant-consent'))
    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))

    await waitFor(() => {
      expect(
        screen.getByText(
          'carbonIntensity:step4.validation.consultantNameRequired'
        )
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

  test('rejects an invalid consultant email', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])
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

  test('passes consultant info through to onSave when consented and valid', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, [
      query,
      theme,
      localization,
      router
    ])

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

  test('disables submit when readOnly is true', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<SignAndSubmitStep {...baseProps} readOnly />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByTestId('ci-step4-submit-btn')).toBeDisabled()
  })

  test('disables submit when isSaving is true', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<SignAndSubmitStep {...baseProps} isSaving />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByTestId('ci-step4-submit-btn')).toBeDisabled()
  })

  test('renders the delete button when onDelete is wired', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<SignAndSubmitStep {...baseProps} onDelete={vi.fn()} />, [
      query,
      theme,
      localization,
      router
    ])
    expect(screen.getByTestId('ci-step4-delete-btn')).toBeInTheDocument()
  })
})
