import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, vi, beforeEach } from 'vitest'

import { AgreementEditForm } from '../AgreementEditForm'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

// Global setup stubs BCFormText.
vi.unmock('@/components/BCForm/BCFormText')

const mockUpdate = vi.fn()
const mockUseUpdateAgreement = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useUpdateAgreement: (...args) => {
    mockUseUpdateAgreement(...args)
    return { mutate: mockUpdate, isPending: false }
  }
}))

const agreement = {
  initiativeAgreementId: 7,
  iaCode: 'IA-26001',
  agreementType: 'Initiative Agreement',
  title: 'Seaweed harvest',
  projectLocation: 'Haida Gwaii',
  projectDescription: 'Harvesting pilot',
  agreementStartDate: '2026-01-01',
  agreementEndDate: '2026-12-31',
  organization: { name: 'LCFS Org 1' }
}

const field = (name) => screen.getByTestId(name)
const change = (name, value) =>
  fireEvent.change(field(name), { target: { value } })
const save = () => fireEvent.click(screen.getByTestId('save-agreement'))

describe('AgreementEditForm', () => {
  const onCancel = vi.fn()
  const onSaved = vi.fn()

  const renderForm = (render, app, props = {}) =>
    render(
      <AgreementEditForm
        agreement={agreement}
        onCancel={onCancel}
        onSaved={onSaved}
        {...props}
      />,
      app
    )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('targets the agreement being edited', ({ render, app }) => {
    renderForm(render, app)
    expect(mockUseUpdateAgreement).toHaveBeenCalledWith(7)
  })

  test('opens with the current values and the organization shown read-only', ({
    render,
    app
  }) => {
    renderForm(render, app)

    expect(field('iaCode')).toHaveValue('IA-26001')
    expect(field('title')).toHaveValue('Seaweed harvest')
    expect(field('projectLocation')).toHaveValue('Haida Gwaii')
    expect(field('projectDescription')).toHaveValue('Harvesting pilot')
    expect(field('agreementStartDate')).toHaveValue('2026-01-01')
    expect(field('agreementEndDate')).toHaveValue('2026-12-31')
    expect(screen.getByTestId('agreement-organization')).toHaveTextContent(
      'LCFS Org 1'
    )
  })

  test('saves the edited agreement and reports the code', async ({
    render,
    app
  }) => {
    mockUpdate.mockImplementation((_payload, handlers) => handlers.onSuccess())
    renderForm(render, app)

    change('iaCode', '  IA-26001-R  ')
    change('title', 'Kelp harvest')
    save()

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('IA-26001-R'))
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        iaCode: 'IA-26001-R',
        agreementType: 'Initiative Agreement',
        title: 'Kelp harvest',
        projectLocation: 'Haida Gwaii',
        projectDescription: 'Harvesting pilot',
        agreementStartDate: '2026-01-01',
        agreementEndDate: '2026-12-31'
      },
      expect.anything()
    )
  })

  test('sends null for optional fields that were cleared', async ({
    render,
    app
  }) => {
    renderForm(render, app)

    change('title', '   ')
    change('projectLocation', '')
    save()

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ title: null, projectLocation: null }),
      expect.anything()
    )
  })

  test('will not save without a code', async ({ render, app }) => {
    renderForm(render, app)

    change('iaCode', '   ')
    save()

    expect(
      await screen.findByText('initiativeAgreement:edit.codeRequired')
    ).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test('will not save a code longer than the database allows', async ({
    render,
    app
  }) => {
    renderForm(render, app)

    change('iaCode', 'X'.repeat(51))
    save()

    expect(
      await screen.findByText('initiativeAgreement:edit.tooLong')
    ).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test('will not save an end date before the start date', async ({
    render,
    app
  }) => {
    renderForm(render, app, {
      agreement: {
        ...agreement,
        agreementStartDate: '2026-09-01',
        agreementEndDate: '2026-08-01'
      }
    })

    save()

    expect(
      await screen.findByText('initiativeAgreement:edit.endBeforeStart')
    ).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test('shows the reason the API refused and stays open', async ({
    render,
    app
  }) => {
    mockUpdate.mockImplementation((_payload, handlers) =>
      handlers.onError({
        response: { data: { detail: "Agreement code 'X' is already in use." } }
      })
    )
    renderForm(render, app)
    save()

    expect(await screen.findByTestId('edit-agreement-error')).toHaveTextContent(
      'already in use'
    )
    expect(onSaved).not.toHaveBeenCalled()
  })

  test('falls back to a generic message when the API gives no detail', async ({
    render,
    app
  }) => {
    mockUpdate.mockImplementation((_payload, handlers) => handlers.onError({}))
    renderForm(render, app)
    save()

    expect(await screen.findByTestId('edit-agreement-error')).toHaveTextContent(
      'initiativeAgreement:edit.failed'
    )
  })

  test('cancel leaves without saving', ({ render, app }) => {
    renderForm(render, app)

    change('title', 'Throwaway')
    fireEvent.click(screen.getByTestId('cancel-agreement-edit'))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
