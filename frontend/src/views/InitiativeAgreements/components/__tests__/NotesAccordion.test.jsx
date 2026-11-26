import 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, vi, beforeEach } from 'vite-plus/test'

import { NotesAccordion } from '../NotesAccordion'
import { roles } from '@/constants/roles'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values) => (values ? `${key} ${JSON.stringify(values)}` : key)
  })
}))

let mockRoles = [roles.ia_analyst]
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { roles: mockRoles.map((name) => ({ name })) },
    hasRoles: (...names) => names.some((name) => mockRoles.includes(name))
  })
}))

vi.mock('../NoteRichTextEditor', () => ({
  NoteRichTextEditor: ({ value, onChange, label }) => (
    <textarea
      data-test="mock-editor"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}))

const mockNotes = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useInitiativeAgreementNotes: () => mockNotes(),
  useNextNoteNumber: () => ({ data: 3 }),
  useCreateNote: () => ({ mutateAsync: mockCreate }),
  useUpdateNote: () => ({ mutateAsync: mockUpdate }),
  useDeleteNote: () => ({ mutateAsync: mockDelete }),
  useRecordVersions: () => ({ data: [], isLoading: false })
}))

const note = (number, noteText, extra = {}) => ({
  initiativeAgreementNoteId: number * 10,
  initiativeAgreementId: 5,
  noteNumber: number,
  noteText,
  lastEditedBy: { userProfileId: 1, firstName: 'Ada', lastName: 'Analyst' },
  lastEditedDate: '2026-07-06T18:30:00Z',
  ...extra
})

describe('NotesAccordion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoles = [roles.ia_analyst]
    mockCreate.mockResolvedValue({})
    mockUpdate.mockResolvedValue({})
    mockDelete.mockResolvedValue({})
    mockNotes.mockReturnValue({
      data: [
        note(10, '<p>Tenth</p>'),
        note(1, '<p>First <strong>bold</strong></p>')
      ],
      isLoading: false,
      isError: false
    })
  })

  test('lists notes by number with the last editor and date', ({
    render,
    app
  }) => {
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    const first = screen.getByTestId('note-1')
    const tenth = screen.getByTestId('note-10')
    expect(
      first.compareDocumentPosition(tenth) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(within(first).getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByTestId('note-1-last-edited')).toHaveTextContent(
      /Ada Analyst/
    )
  })

  test('strips scripts and handlers from note content on display', ({
    render,
    app
  }) => {
    mockNotes.mockReturnValue({
      data: [note(1, '<p onclick="x()">Hi</p><script>alert(1)</script>')],
      isLoading: false,
      isError: false
    })
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    const content = screen.getByTestId('note-1')
    expect(content).toHaveTextContent('Hi')
    expect(content.querySelector('script')).toBeNull()
    expect(content.querySelector('[onclick]')).toBeNull()
  })

  test('adds a note starting from the next number, then closes the form', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    await user.click(screen.getByTestId('add-note-button'))
    expect(screen.getByTestId('note-number-input')).toHaveValue(3)
    expect(screen.getByTestId('mock-editor')).toHaveAccessibleName(
      'initiativeAgreement:notes.noteContent'
    )
    await user.type(screen.getByTestId('mock-editor'), '<p>New</p>')
    await user.click(screen.getByTestId('save-note-button'))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        noteNumber: 3,
        noteText: '<p>New</p>'
      })
    )
    await waitFor(() =>
      expect(screen.queryByTestId('add-note-form')).not.toBeInTheDocument()
    )
  })

  test('lets the number be overtyped but refuses one already used', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)
    await user.click(screen.getByTestId('add-note-button'))
    await user.type(screen.getByTestId('mock-editor'), '<p>New</p>')

    const number = screen.getByTestId('note-number-input')
    await user.clear(number)
    await user.type(number, '10')
    await user.click(screen.getByTestId('save-note-button'))

    expect(screen.getByTestId('note-form-error')).toHaveTextContent(
      'initiativeAgreement:notes.numberTaken'
    )
    expect(mockCreate).not.toHaveBeenCalled()

    await user.clear(number)
    await user.type(number, '20')
    await user.click(screen.getByTestId('save-note-button'))
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        noteNumber: 20,
        noteText: '<p>New</p>'
      })
    )
  })

  test('accepts a decimal number, up to two places, and refuses others', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)
    await user.click(screen.getByTestId('add-note-button'))
    await user.type(screen.getByTestId('mock-editor'), '<p>New</p>')
    const number = screen.getByTestId('note-number-input')

    for (const invalid of ['1.234', '0', '-2', 'abc']) {
      await user.clear(number)
      if (invalid !== 'abc') await user.type(number, invalid)
      await user.click(screen.getByTestId('save-note-button'))
      expect(screen.getByTestId('note-form-error')).toHaveTextContent(
        'initiativeAgreement:notes.numberInvalid'
      )
    }
    expect(mockCreate).not.toHaveBeenCalled()

    await user.clear(number)
    await user.type(number, '1.1')
    await user.click(screen.getByTestId('save-note-button'))
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        noteNumber: 1.1,
        noteText: '<p>New</p>'
      })
    )
  })

  test('refuses an empty note', async ({ render, app }) => {
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    await user.click(screen.getByTestId('add-note-button'))
    await user.click(screen.getByTestId('save-note-button'))

    expect(screen.getByTestId('note-form-error')).toHaveTextContent(
      'initiativeAgreement:notes.contentRequired'
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('shows the server message when the number is taken concurrently', async ({
    render,
    app
  }) => {
    mockCreate.mockRejectedValue({
      response: { data: { detail: 'Note 3 already exists.' } }
    })
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)
    await user.click(screen.getByTestId('add-note-button'))
    await user.type(screen.getByTestId('mock-editor'), '<p>New</p>')
    await user.click(screen.getByTestId('save-note-button'))

    expect(await screen.findByTestId('note-form-error')).toHaveTextContent(
      'Note 3 already exists.'
    )
    expect(screen.getByTestId('add-note-form')).toBeInTheDocument()
  })

  test('the pencil loads a note into the edit form and saves changes', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    await user.click(screen.getByTestId('edit-note-1'))
    expect(screen.getByTestId('note-number-input')).toHaveValue(1)
    expect(screen.getByTestId('mock-editor')).toHaveValue(
      '<p>First <strong>bold</strong></p>'
    )
    await user.clear(screen.getByTestId('mock-editor'))
    await user.type(screen.getByTestId('mock-editor'), '<p>Changed</p>')
    await user.click(screen.getByTestId('save-note-button'))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        noteId: 10,
        noteNumber: 1,
        noteText: '<p>Changed</p>'
      })
    )
  })

  test('labels the active form and keeps the other notes visible', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    await user.click(screen.getByTestId('edit-note-1'))

    expect(screen.getByTestId('edit-note-form')).toHaveTextContent(
      'initiativeAgreement:notes.editingTitle'
    )
    expect(screen.getByTestId('note-10')).toBeVisible()
    expect(screen.queryByTestId('edit-note-10')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('cancel-note-button'))
    await user.click(screen.getByTestId('add-note-button'))
    expect(screen.getByTestId('add-note-form')).toHaveTextContent(
      'initiativeAgreement:notes.newNoteTitle'
    )
  })

  test('cancelling an edit leaves the note unchanged', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    await user.click(screen.getByTestId('edit-note-1'))
    await user.click(screen.getByTestId('cancel-note-button'))

    expect(screen.queryByTestId('edit-note-form')).not.toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(screen.getByTestId('note-1')).toBeInTheDocument()
  })

  test('delete asks for confirmation; cancelling returns to the edit form', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    await user.click(screen.getByTestId('edit-note-1'))
    await user.click(screen.getByTestId('delete-note-button'))
    expect(screen.getByTestId('confirm-delete-note')).toBeInTheDocument()
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'common:cancelBtn'
      })
    )

    expect(mockDelete).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(
        screen.queryByTestId('confirm-delete-note')
      ).not.toBeInTheDocument()
    )
    expect(screen.getByTestId('edit-note-form')).toBeInTheDocument()
  })

  test('confirming the delete removes the note and closes the form', async ({
    render,
    app
  }) => {
    const user = userEvent.setup()
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    await user.click(screen.getByTestId('edit-note-1'))
    await user.click(screen.getByTestId('delete-note-button'))
    await user.click(
      screen.getByRole('button', {
        name: /initiativeAgreement:notes.deleteConfirm/
      })
    )

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(10))
    await waitFor(() =>
      expect(screen.queryByTestId('edit-note-form')).not.toBeInTheDocument()
    )
  })

  test('an analyst gets no add, edit or delete controls once the package is read-only (#5554)', ({
    render,
    app
  }) => {
    render(<NotesAccordion initiativeAgreementId={5} readOnly />, app)

    expect(screen.getByTestId('note-1')).toBeInTheDocument()
    expect(screen.queryByTestId('add-note-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-note-1')).not.toBeInTheDocument()
  })

  test('directors read notes but get no add, edit or delete controls', ({
    render,
    app
  }) => {
    mockRoles = [roles.director]
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    expect(screen.getByTestId('note-1')).toBeInTheDocument()
    expect(screen.queryByTestId('add-note-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('edit-note-1')).not.toBeInTheDocument()
  })

  test('renders a long multi-paragraph note and a short one', ({
    render,
    app
  }) => {
    const paragraphs = Array.from(
      { length: 8 },
      (_, index) => `<p>Paragraph ${index + 1}. ${'word '.repeat(150)}</p>`
    ).join('')
    mockNotes.mockReturnValue({
      data: [note(1, paragraphs), note(2, '<p>One sentence.</p>')],
      isLoading: false,
      isError: false
    })
    render(<NotesAccordion initiativeAgreementId={5} />, app)

    expect(screen.getByTestId('note-1').querySelectorAll('p')).toHaveLength(8)
    expect(screen.getByTestId('note-2')).toHaveTextContent('One sentence.')
  })
})

describe('NotesAccordion in a change order (#5555)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('lets the Director edit notes only inside a change order', ({
    render,
    app
  }) => {
    mockRoles = [roles.director]
    mockNotes.mockReturnValue({
      data: [note(1, '<p>First</p>')],
      isLoading: false,
      isError: false
    })
    const { unmount } = render(
      <NotesAccordion initiativeAgreementId={5} inChangeOrder />,
      app
    )
    expect(screen.getByTestId('edit-note-1')).toBeInTheDocument()
    unmount()

    render(<NotesAccordion initiativeAgreementId={5} />, app)
    expect(screen.queryByTestId('edit-note-1')).toBeNull()
  })

  test('marks changed notes and keeps a removed one read-only', ({
    render,
    app
  }) => {
    mockRoles = [roles.ia_analyst]
    mockNotes.mockReturnValue({
      data: [
        note(1, '<p>First</p>', { changeOrderState: 'edited' }),
        note(2, '<p>Second</p>', { changeOrderState: 'removed' })
      ],
      isLoading: false,
      isError: false
    })
    render(<NotesAccordion initiativeAgreementId={5} inChangeOrder />, app)

    expect(
      within(screen.getByTestId('note-1')).getByTestId('change-order-state')
    ).toHaveAttribute('data-state', 'edited')
    expect(screen.getByTestId('edit-note-1')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-note-2')).toBeNull()
  })
})
