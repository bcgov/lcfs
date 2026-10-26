import 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useMutation } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { describe, expect, vi, beforeEach } from 'vitest'

import { EvidenceOfCompletion } from '../EvidenceOfCompletion'
import { DesignatedActionWorkflow } from '../DesignatedActionWorkflow'
import {
  OUTCOME_INFORMATION_REQUESTED,
  OUTCOME_SATISFACTORY
} from '../evidenceConstants'
import { evidencePlainText } from '../evidenceRichText'
import { roles } from '@/constants/roles'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-quill', async () => {
  const React = await import('react')
  const MockQuill = React.forwardRef(function MockQuill(
    { value, onChange, readOnly, modules, formats },
    ref
  ) {
    const input = React.useRef(null)
    const html = React.useRef(value)
    html.current = value
    const template = document.createElement('template')
    template.innerHTML = value
    React.useImperativeHandle(ref, () => ({
      getEditor: () => ({
        root: {
          get innerHTML() {
            return html.current
          },
          setAttribute: (...args) => input.current.setAttribute(...args)
        },
        getModule: () => null,
        getSelection: () => ({ index: 0, length: 0 }),
        getLength: () => evidencePlainText(html.current).length + 1,
        insertText: (_index, text, format, href) => {
          const span = document.createElement('span')
          span.textContent = text
          html.current +=
            format === 'link'
              ? `<a href="${href}">${span.innerHTML}</a>`
              : span.innerHTML
        }
      }),
      focus: () => input.current.focus()
    }))
    return (
      <div>
        <button
          type="button"
          aria-label="Mock attach"
          disabled={readOnly}
          onClick={() => modules.toolbar.handlers.attach()}
        >
          Attach
        </button>
        <textarea
          ref={input}
          value={evidencePlainText(value)}
          readOnly={readOnly}
          data-formats={JSON.stringify(formats)}
          data-toolbar={JSON.stringify(modules.toolbar.container)}
          onChange={(event) => onChange(event.target.value, {}, 'user')}
        />
        {Array.from(template.content.querySelectorAll('a')).map(
          (anchor, index) => (
            <a key={index} href={anchor.getAttribute('href')}>
              {anchor.textContent}
            </a>
          )
        )}
      </div>
    )
  })
  MockQuill.Quill = { import: () => ({}) }
  return {
    default: MockQuill
  }
})

const mockUpload = vi.fn()
const mockDownload = vi.fn()
vi.mock('@/hooks/useDocumentFolders', () => ({
  useFolderUpload: () => ({ mutateAsync: mockUpload })
}))
vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: () => mockDownload
}))
vi.mock('@/components/Documents/DocumentPreviewDialog', () => ({
  default: ({ parentType, parentID, document, onClose }) => (
    <div
      data-test="eoc-document-preview"
      data-parent-type={parentType}
      data-parent-id={parentID}
    >
      {document.fileName}
      <button type="button" onClick={onClose}>
        Close preview
      </button>
    </div>
  )
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

let mockRoles = [roles.ia_analyst]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockRoles.map((name) => ({ name })) },
    hasRoles: (...names) => names.some((name) => mockRoles.includes(name)),
    hasAnyRole: (...names) => names.some((name) => mockRoles.includes(name))
  })
}))

const mockList = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockRemove = vi.fn()
const mockPerformAction = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useDesignatedActionWorkflow: () => ({
    mutate: mockPerformAction,
    isPending: false
  }),
  useEvidenceRequirements: () => mockList(),
  useCreateEvidenceRequirement: () => ({
    mutate: mockCreate,
    isPending: false
  }),
  useUpdateEvidenceRequirement: () =>
    useMutation({
      mutationFn: (payload) =>
        new Promise((resolve, reject) =>
          mockUpdate(payload, { onSuccess: resolve, onError: reject })
        )
    }),
  useDeleteEvidenceRequirement: () => ({ mutate: mockRemove })
}))

const requirement = (overrides = {}) => ({
  evidenceRequirementId: 1,
  designatedActionId: 9,
  requirementNumber: 1,
  title: 'Permits',
  description: 'List of major permits and approvals',
  isActive: true,
  analystReview: '',
  reviewOutcome: null,
  reviewNotes: null,
  missingInformation: null,
  ...overrides
})

const openEoc = (id = 1) =>
  fireEvent.click(screen.getByTestId(`eoc-heading-${id}`))
const editField = (name, id = 1) => {
  const pencil = screen.queryByTestId(`eoc-${name}-${id}-edit`)
  if (pencil) fireEvent.click(pencil)
}
const saveField = (name, id = 1) =>
  act(async () => {
    const field = screen.getByTestId(`eoc-${name}-${id}`)
    if (document.activeElement === field) field.blur()
    else fireEvent.blur(field)
  })

describe('EvidenceOfCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoles = [roles.ia_analyst]
    mockList.mockReturnValue({ data: [requirement()], isLoading: false })
    mockUpdate.mockImplementation((_payload, callbacks) =>
      callbacks?.onSuccess?.()
    )
    mockUpload.mockResolvedValue([42])
    mockDownload.mockResolvedValue(new Blob())
  })

  for (const firstFails of [false, true]) {
    test(`settles overlapping autosaves independently when the first save ${firstFails ? 'fails' : 'succeeds'}`, async ({
      render,
      app
    }) => {
      const pending = []
      mockUpdate.mockImplementation((_payload, callbacks) =>
        pending.push(callbacks)
      )
      mockList.mockReturnValue({
        data: [
          requirement(),
          requirement({ evidenceRequirementId: 2, requirementNumber: 2 })
        ],
        isLoading: false
      })
      render(<EvidenceOfCompletion designatedActionId="9" />, app)
      openEoc(1)
      openEoc(2)
      for (const id of [1, 2]) {
        fireEvent.change(screen.getByTestId(`eoc-review-${id}`), {
          target: { value: `Draft ${id}` }
        })
        await saveField('review', id)
      }
      await waitFor(() => expect(pending).toHaveLength(2))
      expect(screen.getByTestId('eoc-review-1')).toHaveAttribute('readonly')
      expect(screen.getByTestId('eoc-review-2')).toHaveAttribute('readonly')
      await act(async () => {
        if (firstFails) pending[0].onError(new Error('First save failed'))
        else pending[0].onSuccess()
      })
      await waitFor(() =>
        expect(screen.getByTestId('eoc-review-1')).not.toHaveAttribute(
          'readonly'
        )
      )
      expect(screen.getByTestId('eoc-review-2')).toHaveAttribute('readonly')
      if (firstFails) {
        expect(screen.getByText('First save failed')).toBeVisible()
        expect(screen.getByTestId('eoc-review-1')).toHaveValue('Draft 1')
      }
      await act(async () => pending[1].onSuccess())
      await waitFor(() =>
        expect(screen.getByTestId('eoc-review-2')).not.toHaveAttribute(
          'readonly'
        )
      )
    })
  }

  for (const saveFails of [false, true]) {
    test(`requesting information from one EOC waits for another EOC's save and ${saveFails ? 'blocks on failure' : 'continues on success'}`, async ({
      render,
      app
    }) => {
      let saveCallbacks
      let beforeRequest
      mockUpdate.mockImplementation((_payload, callbacks) => {
        saveCallbacks = callbacks
      })
      mockList.mockReturnValue({
        data: [
          requirement({
            reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
            missingInformation: '<p>Existing explanation A</p>'
          }),
          requirement({
            evidenceRequirementId: 2,
            requirementNumber: 2,
            reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
            missingInformation: '<p>Existing explanation B</p>'
          })
        ],
        isLoading: false
      })
      render(
        <EvidenceOfCompletion
          designatedActionId="9"
          renderRequestAction={(item, _complete, waitForSaves) => {
            if (item.evidenceRequirementId === 2) beforeRequest = waitForSaves
            return null
          }}
        />,
        app
      )

      openEoc(1)
      editField('missing-information', 1)
      fireEvent.change(screen.getByTestId('eoc-missing-information-1'), {
        target: { value: '<p>Updated explanation A</p>' }
      })
      await saveField('missing-information', 1)

      const requestResult = beforeRequest().then(
        () => ({ success: true }),
        (error) => ({ success: false, error })
      )
      expect(
        await Promise.race([requestResult, Promise.resolve('pending')])
      ).toBe('pending')

      await act(async () => {
        if (saveFails) saveCallbacks.onError(new Error('Save failed'))
        else saveCallbacks.onSuccess()
      })

      const result = await requestResult
      expect(result.success).toBe(!saveFails)
      if (saveFails)
        expect(result.error).toHaveProperty('message', 'Save failed')
    })
  }

  for (const saveFails of [false, true]) {
    test(`waits for an earlier Missing information save after Evaluation finishes and ${saveFails ? 'blocks on failure' : 'continues on success'}`, async ({
      render,
      app
    }) => {
      const pending = []
      mockUpdate.mockImplementation((_payload, callbacks) =>
        pending.push(callbacks)
      )
      mockList.mockReturnValue({
        data: [
          requirement({
            reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
            missingInformation: '<p>Existing explanation</p>'
          })
        ],
        isLoading: false
      })
      render(
        <EvidenceOfCompletion
          designatedActionId="9"
          renderRequestAction={(item, complete, beforeRequest) => (
            <DesignatedActionWorkflow
              designatedActionId="9"
              availableActions={['request_information']}
              canRequestInformation={complete}
              missingInformation={item.missingInformation}
              beforeAction={beforeRequest}
            />
          )}
        />,
        app
      )
      openEoc()
      for (const name of ['missing-information', 'review']) {
        editField(name)
        fireEvent.change(screen.getByTestId(`eoc-${name}-1`), {
          target: { value: `<p>Updated ${name}</p>` }
        })
        await saveField(name)
      }
      expect(pending).toHaveLength(2)
      await act(async () => pending[1].onSuccess())

      const requestButton = screen.getByTestId('workflow-request_information')
      await act(async () => fireEvent.click(requestButton))
      expect(requestButton).toBeDisabled()
      expect(mockPerformAction).not.toHaveBeenCalled()
      expect(screen.getByTestId('eoc-missing-information-1')).toHaveAttribute(
        'readonly'
      )

      await act(async () => {
        if (saveFails) pending[0].onError(new Error('Explanation save failed'))
        else pending[0].onSuccess()
      })
      if (saveFails) {
        expect(mockPerformAction).not.toHaveBeenCalled()
        expect(screen.getByTestId('workflow-error')).toHaveTextContent(
          'Explanation save failed'
        )
      } else {
        expect(mockPerformAction).toHaveBeenCalledOnce()
      }
    })
  }

  test('retains a failed explanation across other field saves until the explanation is successfully retried', async ({
    render,
    app
  }) => {
    const pending = []
    mockUpdate.mockImplementation((_payload, callbacks) =>
      pending.push(callbacks)
    )
    let beforeRequest
    mockList.mockReturnValue({
      data: [
        requirement({
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
          missingInformation: '<p>Existing explanation</p>'
        })
      ],
      isLoading: false
    })
    render(
      <EvidenceOfCompletion
        designatedActionId="9"
        renderRequestAction={(_item, _complete, waitForSaves) => {
          beforeRequest = waitForSaves
          return null
        }}
      />,
      app
    )
    openEoc()
    editField('missing-information')
    fireEvent.change(screen.getByTestId('eoc-missing-information-1'), {
      target: { value: '<p>Updated explanation</p>' }
    })
    await saveField('missing-information')
    expect(screen.getByTestId('eoc-missing-information-1')).not.toHaveFocus()
    expect(pending).toHaveLength(1)
    await act(async () =>
      pending[0].onError(new Error('Explanation save failed'))
    )

    editField('review')
    fireEvent.change(screen.getByTestId('eoc-review-1'), {
      target: { value: '<p>Updated evaluation</p>' }
    })
    await saveField('review')
    expect(pending).toHaveLength(2)
    expect(mockUpdate.mock.calls[1][0]).toEqual({
      evidenceRequirementId: 1,
      analystReview: '<p>Updated evaluation</p>'
    })
    await act(async () => pending[1].onSuccess())
    await expect(beforeRequest()).rejects.toThrow('Explanation save failed')

    await saveField('missing-information')
    expect(pending).toHaveLength(3)
    await act(async () => pending[2].onSuccess())
    await expect(beforeRequest()).resolves.toBeUndefined()
  })

  test('uploads attachments into designated-action documents and autosaves filename links', async ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    const field = screen.getByTestId('eoc-review-1')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: '<p>Evaluation draft</p>' } })
    const file = new File(['evidence'], 'permit.pdf', {
      type: 'application/pdf'
    })
    fireEvent.change(screen.getByTestId('eoc-review-1-attach-input'), {
      target: { files: [file] }
    })
    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith({
        files: [file],
        folderId: null
      })
    )
    await waitFor(() =>
      expect(field).toHaveValue('Evaluation draft\npermit.pdf')
    )
    await act(async () => {
      fireEvent.blur(field)
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        evidenceRequirementId: 1,
        analystReview: expect.stringContaining(
          '<a href="#eoc-document-42">permit.pdf</a>'
        )
      },
      expect.any(Object)
    )
    expect(mockUpdate.mock.calls[0][0].analystReview).toContain(
      'Evaluation draft'
    )
  })

  test('rejects invalid files without uploading and reports upload failures', async ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    const input = screen.getByTestId('eoc-review-1-attach-input')
    fireEvent.change(input, {
      target: {
        files: [
          new File(['bad'], 'bad.exe', { type: 'application/x-msdownload' })
        ]
      }
    })
    expect(mockUpload).not.toHaveBeenCalled()
    expect(screen.getByText(/bad.exe:/)).toBeVisible()
    mockUpload.mockRejectedValueOnce(new Error('Upload unavailable'))
    fireEvent.change(input, {
      target: {
        files: [new File(['pdf'], 'permit.pdf', { type: 'application/pdf' })]
      }
    })
    await waitFor(() =>
      expect(screen.getByText('Upload unavailable')).toBeVisible()
    )
    expect(screen.getByTestId('eoc-review-1')).not.toHaveAttribute('readonly')
  })

  test('previews saved document links using the designated-action document scope', async ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [
        requirement({
          reviewOutcome: OUTCOME_SATISFACTORY,
          analystReview: '<p><a href="#eoc-document-42">permit.pdf</a></p>'
        })
      ],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    fireEvent.click(screen.getByRole('link', { name: 'permit.pdf' }))
    expect(screen.getByTestId('eoc-document-preview')).toHaveAttribute(
      'data-parent-type',
      'designatedAction'
    )
    expect(screen.getByTestId('eoc-document-preview')).toHaveAttribute(
      'data-parent-id',
      '9'
    )
    expect(mockDownload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(screen.queryByTestId('eoc-document-preview')).not.toBeInTheDocument()
  })

  test('does not upload from a locked field', ({ render, app }) => {
    mockList.mockReturnValue({
      data: [requirement({ reviewOutcome: OUTCOME_SATISFACTORY })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    fireEvent.change(screen.getByTestId('eoc-notes-1-attach-input'), {
      target: {
        files: [new File(['pdf'], 'permit.pdf', { type: 'application/pdf' })]
      }
    })
    expect(mockUpload).not.toHaveBeenCalled()
  })

  test('renders collapsed requirements with Notes always present and no Notes checkbox', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    expect(screen.getByTestId('eoc-heading-1')).toHaveTextContent('1. Permits')
    expect(screen.getByTestId('eoc-description-1')).not.toBeVisible()
    expect(screen.queryByTestId('eoc-notes-toggle-1')).not.toBeInTheDocument()
    openEoc()
    expect(screen.getByTestId('eoc-notes-1')).toBeVisible()
    expect(screen.getByTestId('eoc-description-1')).toHaveValue(
      'List of major permits and approvals'
    )
  })

  for (const outcome of [
    null,
    OUTCOME_SATISFACTORY,
    OUTCOME_INFORMATION_REQUESTED
  ]) {
    test(`autosaves editable fields and locks Notes and summary for ${outcome ?? 'unreviewed'} evidence`, async ({
      render,
      app
    }) => {
      mockList.mockReturnValue({
        data: [
          requirement({ reviewOutcome: outcome, reviewNotes: 'Saved notes' })
        ],
        isLoading: false
      })
      render(<EvidenceOfCompletion designatedActionId="9" />, app)
      openEoc()
      const fields = ['notes', 'description', 'review']
      if (outcome === OUTCOME_INFORMATION_REQUESTED)
        fields.push('missing-information')
      for (const name of fields) {
        const field = screen.getByTestId(`eoc-${name}-1`)
        if (outcome) expect(field).toHaveAttribute('readonly')
        expect(
          screen.queryByTestId(`eoc-${name}-1-save`)
        ).not.toBeInTheDocument()
        expect(
          screen.queryByTestId(`eoc-${name}-1-cancel`)
        ).not.toBeInTheDocument()
        if (name === 'notes' || name === 'description') {
          expect(
            screen.queryByTestId(`eoc-${name}-1-edit`)
          ).not.toBeInTheDocument()
          if (outcome) continue
        }
        editField(name)
        expect(field).not.toHaveAttribute('readonly')
        const other = name === 'description' ? 'review' : 'description'
        if (outcome) {
          expect(screen.getByTestId(`eoc-${other}-1`)).toHaveAttribute(
            'readonly'
          )
        }
        fireEvent.change(field, {
          target: { value: '<p><strong>Updated</strong> evidence</p>' }
        })
        expect(mockUpdate).not.toHaveBeenCalled()
        expect(field).not.toHaveAttribute('readonly')
        await saveField(name)
        const payloadKey = {
          notes: 'reviewNotes',
          description: 'description',
          review: 'analystReview',
          'missing-information': 'missingInformation'
        }[name]
        expect(mockUpdate).toHaveBeenCalledWith(
          {
            evidenceRequirementId: 1,
            [payloadKey]: '<p><strong>Updated</strong> evidence</p>'
          },
          expect.any(Object)
        )
        if (outcome) {
          expect(field).toHaveAttribute('readonly')
          expect(screen.getByTestId(`eoc-${name}-1-edit`)).toBeVisible()
        }
        mockUpdate.mockClear()
      }
    })
  }

  test('autosaves rich HTML on blur and acknowledges a successful save', async ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    editField('review')
    const field = screen.getByTestId('eoc-review-1')
    fireEvent.change(field, {
      target: { value: '<p><strong>Permits</strong> verified.</p>' }
    })
    expect(mockUpdate).not.toHaveBeenCalled()
    await saveField('review')
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        evidenceRequirementId: 1,
        analystReview: '<p><strong>Permits</strong> verified.</p>'
      },
      expect.any(Object)
    )
    expect(screen.getByTestId('eoc-saved-1')).toBeInTheDocument()
  })

  test('clearing an outcome makes Notes and summary editable again without pencils', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [requirement({ reviewOutcome: OUTCOME_SATISFACTORY })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    expect(screen.getByTestId('eoc-description-1')).toHaveAttribute('readonly')
    expect(screen.getByTestId('eoc-notes-1')).toHaveAttribute('readonly')
    fireEvent.click(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    )
    for (const name of ['notes', 'description']) {
      expect(screen.getByTestId(`eoc-${name}-1`)).not.toHaveAttribute(
        'readonly'
      )
      expect(screen.queryByTestId(`eoc-${name}-1-edit`)).not.toBeInTheDocument()
    }
  })

  test('saving an unchanged field does not send an update', async ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    editField('description')
    await saveField('description')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(screen.getByTestId('eoc-description-1')).not.toHaveAttribute(
      'readonly'
    )
  })

  test('keeps a failed save editable and displays the error instead of reporting success', async ({
    render,
    app
  }) => {
    mockUpdate.mockImplementation((_payload, callbacks) =>
      callbacks.onError(new Error('Unable to save evidence'))
    )
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    editField('review')
    fireEvent.change(screen.getByTestId('eoc-review-1'), {
      target: { value: '<p>Keep my draft</p>' }
    })
    await saveField('review')
    expect(screen.getByText('Unable to save evidence')).toBeVisible()
    expect(screen.getByTestId('eoc-review-1')).not.toHaveAttribute('readonly')
    expect(screen.getByTestId('eoc-review-1')).toHaveValue('Keep my draft')
    expect(screen.queryByTestId('eoc-saved-1')).not.toBeInTheDocument()
  })

  test('restores empty rich-text descriptions but allows clearing optional fields', async ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [requirement({ analystReview: 'Existing evaluation' })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    editField('description')
    fireEvent.change(screen.getByTestId('eoc-description-1'), {
      target: { value: '<p><br></p>' }
    })
    await saveField('description')
    expect(screen.getByTestId('eoc-description-1')).toHaveValue(
      'List of major permits and approvals'
    )
    expect(mockUpdate).not.toHaveBeenCalled()
    editField('review')
    fireEvent.change(screen.getByTestId('eoc-review-1'), {
      target: { value: '<p><br></p>' }
    })
    await saveField('review')
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        evidenceRequirementId: 1,
        analystReview: ''
      },
      expect.any(Object)
    )
  })

  test('keeps an active draft when a refetch updates the saved value', async ({
    render,
    app
  }) => {
    const { rerender } = render(
      <EvidenceOfCompletion designatedActionId="9" />,
      app
    )
    openEoc()
    editField('review')
    fireEvent.focus(screen.getByTestId('eoc-review-1'))
    fireEvent.change(screen.getByTestId('eoc-review-1'), {
      target: { value: 'Half a thought' }
    })
    mockList.mockReturnValue({
      data: [requirement({ analystReview: 'Saved elsewhere' })],
      isLoading: false
    })
    rerender(<EvidenceOfCompletion designatedActionId="9" />)
    expect(screen.getByTestId('eoc-review-1')).toHaveValue('Half a thought')
    await saveField('review')
    expect(mockUpdate).toHaveBeenCalledWith(
      { evidenceRequirementId: 1, analystReview: 'Half a thought' },
      expect.any(Object)
    )
  })

  test('enables only the requested rich-text formats', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    expect(
      JSON.parse(
        screen.getByTestId('eoc-description-1').getAttribute('data-formats')
      )
    ).toEqual([
      'size',
      'bold',
      'italic',
      'align',
      'list',
      'bullet',
      'indent',
      'link'
    ])
    expect(
      JSON.parse(
        screen.getByTestId('eoc-description-1').getAttribute('data-toolbar')
      )
    ).toEqual([
      [{ size: [false, 'small', 'large'] }],
      ['bold', 'italic'],
      [{ align: [false, 'center', 'right'] }],
      [{ list: 'bullet' }, { list: 'ordered' }],
      [{ indent: '-1' }, { indent: '+1' }],
      ['link', 'attach']
    ])
  })

  for (const [control, outcome, state] of [
    ['satisfactory', OUTCOME_SATISFACTORY, 'satisfactory'],
    ['request', OUTCOME_INFORMATION_REQUESTED, 'information-requested']
  ]) {
    test(`records ${outcome}, expands the card, and keeps outcome controls outside the toggle button`, async ({
      render,
      app
    }) => {
      render(<EvidenceOfCompletion designatedActionId="9" />, app)
      const checkbox = screen.getByTestId(`eoc-${control}-1`)
      expect(checkbox.closest('button')).toBeNull()
      await act(async () => {
        fireEvent.click(checkbox.querySelector('input'))
      })
      expect(mockUpdate).toHaveBeenCalledWith(
        {
          evidenceRequirementId: 1,
          reviewOutcome: outcome
        },
        expect.any(Object)
      )
      expect(screen.getByTestId('eoc-summary-1')).toHaveAttribute(
        'aria-expanded',
        'true'
      )
      expect(screen.getByTestId('eoc-card-1')).toHaveAttribute(
        'data-review-state',
        state
      )
    })
  }

  test('outcomes are mutually exclusive and clicking the selected outcome clears it', async ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [requirement({ reviewOutcome: OUTCOME_SATISFACTORY })],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    expect(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    ).toBeChecked()
    expect(
      screen.getByTestId('eoc-request-1').querySelector('input')
    ).not.toBeChecked()
    await act(async () => {
      fireEvent.click(
        screen.getByTestId('eoc-satisfactory-1').querySelector('input')
      )
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      {
        evidenceRequirementId: 1,
        clearReviewOutcome: true
      },
      expect.any(Object)
    )
  })

  test('does not offer editing without field permissions', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [requirement({ reviewOutcome: OUTCOME_INFORMATION_REQUESTED })],
      isLoading: false
    })
    render(
      <EvidenceOfCompletion
        designatedActionId="9"
        canEdit={false}
        missingInformationReadOnly
      />,
      app
    )
    openEoc()
    for (const name of [
      'notes',
      'description',
      'review',
      'missing-information'
    ]) {
      expect(screen.getByTestId(`eoc-${name}-1`)).toHaveAttribute('readonly')
      expect(screen.queryByTestId(`eoc-${name}-1-edit`)).not.toBeInTheDocument()
    }
    expect(screen.queryByTestId('eoc-remove-1')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('eoc-satisfactory-1').querySelector('input')
    ).toBeDisabled()
  })

  test('uses description text as the heading for legacy requirements without titles', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [
        requirement({
          title: null,
          description: '<p><strong>Legacy</strong> requirement</p>'
        })
      ],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    expect(screen.getByTestId('eoc-heading-1')).toHaveTextContent(
      '1. Legacy requirement'
    )
  })

  test('creates a titled requirement from the rich-text modal', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    fireEvent.click(screen.getByTestId('eoc-add-button'))
    fireEvent.change(screen.getByTestId('eoc-new-title'), {
      target: { value: 'Risk register' }
    })
    fireEvent.change(screen.getByTestId('eoc-new-description'), {
      target: { value: '<p>Risks and <strong>mitigations</strong></p>' }
    })
    fireEvent.click(
      screen.getByText('initiativeAgreement:evidence.createRequirement')
    )
    expect(mockCreate).toHaveBeenCalledWith({
      title: 'Risk register',
      description: '<p>Risks and <strong>mitigations</strong></p>'
    })
  })

  test('waits for description attachments before creating a requirement', async ({
    render,
    app
  }) => {
    let finishUpload
    mockUpload.mockReturnValueOnce(
      new Promise((resolve) => {
        finishUpload = resolve
      })
    )
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    fireEvent.click(screen.getByTestId('eoc-add-button'))
    fireEvent.change(screen.getByTestId('eoc-new-title'), {
      target: { value: 'Risk register' }
    })
    fireEvent.change(screen.getByTestId('eoc-new-description'), {
      target: { value: '<p>Risk register evidence</p>' }
    })
    fireEvent.change(screen.getByTestId('eoc-new-description-attach-input'), {
      target: {
        files: [
          new File(['pdf'], 'risk-register.pdf', { type: 'application/pdf' })
        ]
      }
    })

    const createButton = screen
      .getByText('initiativeAgreement:evidence.createRequirement')
      .closest('button')
    await waitFor(() => expect(mockUpload).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(
        screen.getByText('initiativeAgreement:evidence.attachmentUploading')
      ).toBeVisible()
    )
    fireEvent.click(createButton)
    expect(mockCreate).not.toHaveBeenCalled()

    await act(async () => finishUpload([42]))
    await waitFor(() => expect(createButton).not.toBeDisabled())
    fireEvent.click(createButton)

    expect(mockCreate).toHaveBeenCalledWith({
      title: 'Risk register',
      description: expect.stringContaining(
        '<a href="#eoc-document-42">risk-register.pdf</a>'
      )
    })
  })

  test('does not create a requirement without both a title and nonempty description', ({
    render,
    app
  }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    fireEvent.click(screen.getByTestId('eoc-add-button'))
    fireEvent.change(screen.getByTestId('eoc-new-title'), {
      target: { value: 'Risk register' }
    })
    fireEvent.change(screen.getByTestId('eoc-new-description'), {
      target: { value: '<p><br></p>' }
    })
    fireEvent.click(
      screen.getByText('initiativeAgreement:evidence.createRequirement')
    )
    expect(mockCreate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('common:cancelBtn'))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('requires confirmation to remove a requirement', ({ render, app }) => {
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    openEoc()
    fireEvent.click(screen.getByTestId('eoc-remove-1'))
    expect(mockRemove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('common:cancelBtn'))
    expect(mockRemove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('eoc-remove-1'))
    fireEvent.click(
      screen.getByText('initiativeAgreement:evidence.confirmRemove')
    )
    expect(mockRemove).toHaveBeenCalledWith(1)
  })

  test('places Add EOC in the header and expands/collapses all requirements without hiding it', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [
        requirement(),
        requirement({ evidenceRequirementId: 2, requirementNumber: 2 })
      ],
      isLoading: false
    })
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    expect(screen.getByTestId('eoc-header')).toContainElement(
      screen.getByTestId('eoc-add-button')
    )
    expect(screen.queryByTestId('eoc-toggle')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('eoc-expand-all'))
    expect(screen.getByTestId('eoc-summary-1')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByTestId('eoc-summary-2')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    fireEvent.click(screen.getByTestId('eoc-summary-1'))
    expect(screen.getByTestId('eoc-summary-2')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    fireEvent.click(screen.getByTestId('eoc-collapse-all'))
    expect(screen.getByTestId('eoc-summary-1')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.getByTestId('eoc-summary-2')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.getByTestId('eoc-add-button')).toBeVisible()
  })

  test('supports keyboard toggling and a single rotating chevron', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    const toggle = screen.getByTestId('eoc-summary-1')
    expect(toggle.querySelector('svg')).toHaveStyle({ transform: 'none' })
    toggle.focus()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle.querySelector('svg')).toHaveStyle({
      transform: 'rotate(180deg)'
    })
    await user.keyboard(' ')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    screen.getByTestId('eoc-expand-all').focus()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    screen.getByTestId('eoc-collapse-all').focus()
    await user.keyboard(' ')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('hides Add EOC from directors', ({ render, app }) => {
    mockRoles = [roles.director]
    render(<EvidenceOfCompletion designatedActionId="9" />, app)
    expect(screen.queryByTestId('eoc-add-button')).not.toBeInTheDocument()
  })

  test('shows an empty state when no EOC has been added', ({ render, app }) => {
    mockList.mockReturnValue({ data: [], isLoading: false })
    const renderRequestAction = vi.fn()
    render(
      <EvidenceOfCompletion
        designatedActionId="9"
        renderRequestAction={renderRequestAction}
      />,
      app
    )
    expect(
      screen.getByText('initiativeAgreement:evidence.empty')
    ).toBeInTheDocument()
    expect(renderRequestAction).not.toHaveBeenCalled()
  })

  test('renders requests per EOC and blocks empty rich-text requests', ({
    render,
    app
  }) => {
    mockList.mockReturnValue({
      data: [
        requirement({
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
          missingInformation: '<p>The signed permit.</p>'
        }),
        requirement({
          evidenceRequirementId: 2,
          requirementNumber: 2,
          reviewOutcome: OUTCOME_INFORMATION_REQUESTED,
          missingInformation: '<p><br></p>'
        }),
        requirement({
          evidenceRequirementId: 3,
          requirementNumber: 3,
          reviewOutcome: OUTCOME_SATISFACTORY
        })
      ],
      isLoading: false
    })
    render(
      <EvidenceOfCompletion
        designatedActionId="9"
        renderRequestAction={(item, complete) => (
          <div
            data-test={`request-action-${item.evidenceRequirementId}`}
            data-complete={String(complete)}
          />
        )}
      />,
      app
    )
    expect(screen.getByTestId('request-action-1')).toHaveAttribute(
      'data-complete',
      'false'
    )
    expect(screen.getByTestId('request-action-2')).toHaveAttribute(
      'data-complete',
      'false'
    )
    expect(screen.queryByTestId('request-action-3')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('eoc-missing-information-3')
    ).not.toBeInTheDocument()
    openEoc()
    expect(screen.getByTestId('eoc-missing-information-1')).toHaveValue(
      'The signed permit.'
    )
  })
})
