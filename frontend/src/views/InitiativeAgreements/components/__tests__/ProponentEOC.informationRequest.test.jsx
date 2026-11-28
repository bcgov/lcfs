import 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, vi } from 'vite-plus/test'
import { test } from '@/tests/utils/fixtures'
import { ProponentEOC } from '../ProponentEOC'

// Requests for additional information on one EOC (#5545), as the BCeID
// proponent and signer answer them, and as IDIR reads the history.

let signer = false
const api = {
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  delete: vi.fn()
}
vi.mock('@/services/useApiService', () => ({ useApiService: () => api }))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ hasRoles: () => signer })
}))
vi.mock('react-router-dom', async (original) => ({
  ...(await original()),
  useParams: () => ({ initiativeAgreementId: '2' }),
  useBlocker: () => ({ state: 'unblocked' })
}))
vi.mock('../DocumentTree', () => ({
  default: () => <div data-test="document-tree" />,
  DocumentTree: () => <div data-test="document-tree" />
}))
vi.mock('@/components/Comments', () => ({ default: () => null }))
vi.mock('@/components/Documents/DocumentUploadDialog', () => ({
  default: () => null
}))
vi.mock('@/hooks/useDocuments', () => ({
  useDownloadDocument: () => vi.fn()
}))
vi.mock('react-quill', () => ({
  default: ({ value, onChange, readOnly }) => (
    <textarea
      aria-label="Evidence response"
      value={value}
      disabled={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}))

const URL = '/initiative-agreements/designated-actions/3/eoc'
const response = (summary) => ({
  summaryOfWorkCompleted: summary,
  howEvidenceMeetsAgreementRequirements: 'How',
  exceptionsLimitationsAndContext: 'None'
})

const openRequest = (overrides = {}) => ({
  id: 41,
  submissionId: 7,
  evidenceRequirementId: 11,
  requirementNumber: 1,
  status: 'Requested',
  missingInformation: '<p>Please add the commissioning report</p>',
  requestedAt: '2026-11-20T18:00:00Z',
  requestedBy: null,
  response: response('Original one'),
  documents: [
    {
      documentId: 501,
      fileName: 'report.pdf',
      displayName: null,
      canChange: true
    },
    {
      documentId: 502,
      fileName: 'colleague.pdf',
      displayName: null,
      canChange: false
    }
  ],
  canEdit: true,
  canSubmit: true,
  ...overrides
})

const page = (requests) => ({
  designatedActionId: 3,
  initiativeAgreementId: 2,
  iaCode: 'IA-2',
  actionNumber: 1,
  name: 'Install equipment',
  organizationName: 'Example company',
  status: 'Submitted',
  canEdit: false,
  submittedAt: '2026-11-17T18:00:00Z',
  requirements: [
    { id: 11, requirementNumber: 1, title: 'Commissioning' },
    { id: 12, requirementNumber: 2, title: 'Invoices' }
  ],
  evidenceResponses: {
    11: response('Original one'),
    12: response('Original two')
  },
  submissions: [
    {
      id: 7,
      status: 'Submitted',
      submittedAt: '2026-11-17T18:00:00Z',
      requirements: [
        { id: 11, requirementNumber: 1, title: 'Commissioning' },
        { id: 12, requirementNumber: 2, title: 'Invoices' }
      ],
      evidenceResponses: {
        11: response('Original one'),
        12: response('Original two')
      },
      documents: []
    }
  ],
  informationRequests: requests,
  submissionInformationRequests: { 7: requests }
})

beforeEach(() => {
  signer = false
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: page([openRequest()]) })
  api.put.mockResolvedValue({ data: page([openRequest()]) })
  api.post.mockResolvedValue({ data: page([openRequest()]) })
  api.delete.mockResolvedValue({ data: { message: 'File removed' } })
})

describe('BCeID proponent', () => {
  test('only the requested EOC opens, with what government asked', async ({
    render,
    app
  }) => {
    render(<ProponentEOC designatedActionId="3" />, app)
    const banner = await screen.findByText('Additional information requested', {
      selector: 'p'
    })
    expect(banner).toBeInTheDocument()
    expect(
      screen.getByText(/requested additional information for EOC 1/)
    ).toBeInTheDocument()
    const ask = await screen.findByTestId('eoc-information-missing-41')
    expect(ask).toHaveTextContent('Please add the commissioning report')
    // The banner is a status on load, not an interrupting alert.
    expect(screen.queryByRole('alert')).toBeNull()

    // EOC 1 is open and editable; EOC 2 is read-only once expanded.
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    const section = screen.getAllByTestId('eoc-response-section-11')[0]
    const editable = within(section).getAllByLabelText('Evidence response')
    expect(editable.every((field) => !field.disabled)).toBe(true)
    const other = screen.getAllByTestId('eoc-response-section-12')[0]
    expect(
      within(other)
        .getAllByLabelText('Evidence response')
        .every((field) => field.disabled)
    ).toBe(true)
    // A status chip names the open EOC for every user, not only by colour.
    expect(
      within(section).getByTestId('eoc-response-status-11')
    ).toHaveTextContent('Additional information requested')
  })

  test('proponents save the answer; only a signer submits', async ({
    render,
    app
  }) => {
    render(<ProponentEOC designatedActionId="3" />, app)
    const [section] = await screen.findAllByTestId('eoc-response-section-11')
    fireEvent.change(
      within(section).getAllByLabelText('Evidence response')[0],
      {
        target: { value: 'More detail' }
      }
    )
    expect(screen.getByTestId('eoc-information-status-41')).toHaveTextContent(
      'Unsaved changes'
    )
    fireEvent.click(screen.getByTestId('eoc-information-save-41'))
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        `${URL}/information-requests/41`,
        response('More detail')
      )
    )
    expect(
      await screen.findByTestId('eoc-information-status-41')
    ).toHaveTextContent('Saved.')
    expect(
      screen.queryByRole('button', {
        name: 'Submit additional information for EOC 1'
      })
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('eoc-information-signer-note-41')).toBeVisible()
  })

  test('a signer submits, and a refusal is announced as an alert', async ({
    render,
    app
  }) => {
    signer = true
    api.post.mockRejectedValueOnce({
      response: { data: { detail: 'This request was replaced.' } }
    })
    render(<ProponentEOC designatedActionId="3" />, app)
    const submit = await screen.findByRole('button', {
      name: 'Submit additional information for EOC 1'
    })
    fireEvent.click(submit)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This request was replaced.')
    await waitFor(() => expect(alert).toHaveFocus())

    api.post.mockResolvedValueOnce({
      data: page([
        openRequest({
          status: 'Submitted',
          canEdit: false,
          canSubmit: false,
          submittedAt: '2026-11-21T18:00:00Z',
          submittedBy: 'Sam Signer',
          response: response('Answered'),
          documents: [{ documentId: 501, fileName: 'report.pdf' }]
        })
      ])
    })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith(
        `${URL}/information-requests/41/submit`,
        response('Original one')
      )
    )
    // The EOC closes again and the page's live region confirms it.
    expect(
      await screen.findByText('Additional information submitted.')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('eoc-information-save-41')).toBeNull()
    expect(
      screen.queryByTestId('eoc-information-request-banner')
    ).not.toBeInTheDocument()
  })

  test('files: add, rename and remove only your own', async ({
    render,
    app
  }) => {
    render(<ProponentEOC designatedActionId="3" />, app)
    await screen.findByTestId('eoc-information-documents-41')
    expect(
      screen.getByRole('button', { name: 'Rename report.pdf' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Rename colleague.pdf' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remove colleague.pdf' })
    ).not.toBeInTheDocument()

    const file = new File(['%PDF-1.4'], 'invoice.pdf', {
      type: 'application/pdf'
    })
    fireEvent.change(screen.getByTestId('eoc-information-file-input-41'), {
      target: { files: [file] }
    })
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `${URL}/information-requests/41/documents`,
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
    )
    expect(api.post.mock.calls[0][1].get('file')).toBe(file)

    fireEvent.click(screen.getByRole('button', { name: 'Rename report.pdf' }))
    const name = await screen.findByLabelText('File name')
    fireEvent.change(name, { target: { value: 'Commissioning report' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        `${URL}/information-requests/41/documents/501`,
        { displayName: 'Commissioning report' }
      )
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove report.pdf' })
    )
    fireEvent.click(await screen.findByTestId('eoc-information-remove-confirm'))
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(
        `${URL}/information-requests/41/documents/501`
      )
    )
  })

  test('a file the portal cannot take is reported, not sent', async ({
    render,
    app
  }) => {
    render(<ProponentEOC designatedActionId="3" />, app)
    await screen.findByTestId('eoc-information-documents-41')
    const file = new File(['x'], 'tool.exe', {
      type: 'application/x-msdownload'
    })
    fireEvent.change(screen.getByTestId('eoc-information-file-input-41'), {
      target: { files: [file] }
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('tool.exe')
    expect(api.post).not.toHaveBeenCalled()
  })

  test('nothing opens when the request is not editable by this user', async ({
    render,
    app
  }) => {
    api.get.mockResolvedValue({
      data: page([openRequest({ canEdit: false, canSubmit: false })])
    })
    render(<ProponentEOC designatedActionId="3" />, app)
    await screen.findByText('Example company')
    expect(screen.queryByTestId('eoc-information-request-banner')).toBeNull()
    expect(screen.queryByTestId('eoc-information-save-41')).toBeNull()
  })
})

describe('history', () => {
  test('IDIR reads every cycle with what was asked and answered', async ({
    render,
    app
  }) => {
    const cycles = [
      openRequest({
        id: 41,
        status: 'Submitted',
        requestedBy: 'Ana Lyst',
        missingInformation: '<p>First question</p>',
        submittedAt: '2026-11-21T18:00:00Z',
        submittedBy: 'Sam Signer',
        response: response('First answer'),
        documents: [{ documentId: 501, fileName: 'report.pdf' }],
        canEdit: false,
        canSubmit: false
      }),
      openRequest({
        id: 42,
        status: 'Requested',
        requestedBy: 'Ana Lyst',
        missingInformation: '<p>Second question</p>',
        response: null,
        documents: [],
        canEdit: false,
        canSubmit: false
      })
    ]
    api.get.mockResolvedValue({ data: page(cycles) })
    render(<ProponentEOC designatedActionId="3" readOnly />, app)
    const history = await screen.findByTestId('eoc-information-history-7:11')
    expect(within(history).getByText(/Request 1/)).toHaveTextContent(
      'by Ana Lyst'
    )
    expect(within(history).getByText('First question')).toBeInTheDocument()
    expect(within(history).getByText('Second question')).toBeInTheDocument()
    expect(
      within(history).getByTestId('eoc-information-cycle-status-41')
    ).toHaveTextContent('by Sam Signer')
    expect(
      within(history).getByTestId('eoc-information-cycle-status-42')
    ).toHaveTextContent('Waiting for the proponent')
    expect(
      within(history).getByRole('button', { name: 'Download report.pdf' })
    ).toBeInTheDocument()
    // Read-only: no file changes, no save.
    expect(within(history).queryByRole('button', { name: /Rename/ })).toBeNull()
    expect(screen.queryByTestId('eoc-information-save-42')).toBeNull()
  })
})
