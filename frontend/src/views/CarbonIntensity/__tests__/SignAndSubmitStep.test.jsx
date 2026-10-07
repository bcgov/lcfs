import { test } from '@/tests/utils/fixtures'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'

import { SignAndSubmitStep } from '@/views/CarbonIntensity/components/SignAndSubmitStep'
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

const checkRequiredDeclarations = () => {
  fireEvent.click(screen.getByTestId('ci-step4-decl-1'))
  fireEvent.click(screen.getByTestId('ci-step4-decl-2'))
  fireEvent.click(screen.getByTestId('ci-step4-decl-3'))
}

const confirmSubmitInModal = () => {
  const modal = screen.getByTestId('modal')
  fireEvent.click(within(modal).getByText('carbonIntensity:step4.submit'))
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

  test('opens a confirmation modal before submitting (#4773)', async ({
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

    checkRequiredDeclarations()
    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))

    const modal = screen.getByTestId('modal')
    expect(modal).toBeInTheDocument()
    expect(within(modal).getByText('common:confirmation')).toBeInTheDocument()
    expect(
      within(modal).getByText('carbonIntensity:step4.submitConfirmText')
    ).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  test('does not submit when the confirmation is cancelled (#4773)', async ({
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

    checkRequiredDeclarations()
    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))
    fireEvent.click(
      within(screen.getByTestId('modal')).getByText('common:cancelBtn')
    )

    expect(onSave).not.toHaveBeenCalled()
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

    checkRequiredDeclarations()
    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))
    confirmSubmitInModal()

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

    checkRequiredDeclarations()
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
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
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
    checkRequiredDeclarations()
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
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
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

    checkRequiredDeclarations()
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
    confirmSubmitInModal()

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

  test('disables declarations and submit without Signing Authority role', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const onSave = vi.fn()
    render(
      <SignAndSubmitStep
        {...baseProps}
        onSave={onSave}
        hasSigningAuthority={false}
      />,
      [query, theme, localization, router]
    )

    const tooltipText =
      'carbonIntensity:step4.declarations.signingAuthorityRequired'

    expect(screen.getByTestId('ci-step4-decl-1')).toBeDisabled()
    expect(screen.getByTestId('ci-step4-decl-2')).toBeDisabled()
    expect(screen.getByTestId('ci-step4-decl-3')).toBeDisabled()
    expect(screen.getByTestId('ci-step4-decl-1-tooltip')).toHaveAttribute(
      'aria-label',
      tooltipText
    )

    fireEvent.click(screen.getByTestId('ci-step4-decl-1'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-2'))
    fireEvent.click(screen.getByTestId('ci-step4-decl-3'))

    expect(screen.getByTestId('ci-step4-submit-btn')).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
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

  // --- Consultant auto-save (#4772) -------------------------------------
  describe('consultant auto-save', () => {
    const openConsultantBlock = () => {
      fireEvent.click(screen.getByTestId('ci-step4-consultant-consent'))
    }

    test('saves a consultant field on blur', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const onAutoSave = vi.fn()
      render(<SignAndSubmitStep {...baseProps} onAutoSave={onAutoSave} />, [
        query,
        theme,
        localization,
        router
      ])
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

    test('does not re-save when a blur changed nothing', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const onAutoSave = vi.fn()
      render(<SignAndSubmitStep {...baseProps} onAutoSave={onAutoSave} />, [
        query,
        theme,
        localization,
        router
      ])
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

    test('clears stored details when consent is withdrawn', async ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
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
        [query, theme, localization, router]
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

    test('restores saved consultant details when a draft is reopened', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
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
        [query, theme, localization, router]
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

    test('does not auto-save before Step 1 has created the draft', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
      const onAutoSave = vi.fn()
      render(
        <SignAndSubmitStep
          {...baseProps}
          ciApplication={undefined}
          onAutoSave={onAutoSave}
        />,
        [query, theme, localization, router]
      )
      openConsultantBlock()

      const name = screen.getByTestId('ci-step4-consultant-name')
      fireEvent.change(name, { target: { value: 'Sam Anderson' } })
      fireEvent.blur(name)

      expect(onAutoSave).not.toHaveBeenCalled()
    })

    test('does not auto-save when readOnly', ({
      render,
      query,
      theme,
      localization,
      router
    }) => {
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
        [query, theme, localization, router]
      )

      fireEvent.blur(screen.getByTestId('ci-step4-consultant-name'))
      expect(onAutoSave).not.toHaveBeenCalled()
    })
  })
})
