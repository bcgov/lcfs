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

  it('blocks submission when not all declarations are checked', async () => {
    const onSave = vi.fn()
    render(<SignAndSubmitStep {...baseProps} onSave={onSave} />, { wrapper })
    fireEvent.click(screen.getByTestId('ci-step4-submit-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('ci-step4-decl-error')).toBeInTheDocument()
    })
    expect(onSave).not.toHaveBeenCalled()
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
      expect(screen.getByTestId('ci-step4-consultant-error')).toBeInTheDocument()
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
      expect(screen.getByTestId('ci-step4-consultant-error')).toBeInTheDocument()
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
})
