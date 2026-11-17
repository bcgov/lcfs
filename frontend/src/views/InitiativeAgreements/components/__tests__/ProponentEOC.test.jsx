import 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, vi } from 'vite-plus/test'
import { test } from '@/tests/utils/fixtures'
import { ProponentEOC } from '../ProponentEOC'

let signer = false
let submitted = false
const api = { get: vi.fn(), put: vi.fn(), post: vi.fn() }
vi.mock('@/services/useApiService', () => ({ useApiService: () => api }))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ hasRoles: () => signer })
}))
vi.mock('react-router-dom', async (original) => ({
  ...(await original()),
  useParams: () => ({ initiativeAgreementId: '2' })
}))
vi.mock('../DocumentTree', () => ({
  DocumentTree: ({ readOnly }) => (
    <div data-test="document-tree" data-read-only={String(readOnly)} />
  )
}))
vi.mock('@/components/Comments', () => ({
  default: () => <div>Shared comments</div>
}))
vi.mock('@/components/Documents/DocumentUploadDialog', () => ({
  default: () => null
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

beforeEach(() => {
  signer = false
  submitted = false
  vi.clearAllMocks()
  api.get.mockImplementation(async () => ({
    data: {
      initiativeAgreementId: 2,
      iaCode: 'IA-2',
      actionNumber: 1,
      name: 'Install equipment',
      organizationName: 'Example company',
      status: submitted ? 'Submitted' : 'Draft',
      submittedAt: submitted ? '2026-11-17T18:00:00Z' : null,
      content: { summary_of_work_completed: 'Existing evidence' },
      requirements: [
        {
          id: 'summary_of_work_completed',
          title: 'Equipment',
          description: 'Provide installation evidence'
        }
      ]
    }
  }))
  api.put.mockResolvedValue({ data: {} })
  api.post.mockImplementation(async () => {
    submitted = true
    return { data: {} }
  })
})

test('proponents save and autosave but cannot sign or submit', async ({
  render,
  app
}) => {
  render(<ProponentEOC designatedActionId="3" />, app)
  await screen.findByText('Organization: Example company')
  expect(screen.getByText('Initiative agreement: IA-2')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
  fireEvent.change(screen.getByLabelText('Evidence response'), {
    target: { value: 'Updated evidence' }
  })
  await waitFor(
    () =>
      expect(api.put).toHaveBeenCalledWith(
        '/initiative-agreements/designated-actions/3/eoc',
        {
          summaryOfWorkCompleted: 'Updated evidence',
          howEvidenceMeetsAgreementRequirements: '',
          exceptionsLimitationsAndContext: '',
          declarationAccepted: false
        }
      ),
    { timeout: 2500 }
  )
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save to draft' })).toBeEnabled()
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save to draft' }))
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2))
  expect(api.post).not.toHaveBeenCalled()
})

test('signers accept declaration and submitted evidence becomes read-only', async ({
  render,
  app
}) => {
  signer = true
  render(<ProponentEOC designatedActionId="3" />, app)
  await screen.findByText('Organization: Example company')
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Submit application' }))
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      '/initiative-agreements/designated-actions/3/eoc/submit',
      {
        summaryOfWorkCompleted: 'Existing evidence',
        howEvidenceMeetsAgreementRequirements: '',
        exceptionsLimitationsAndContext: '',
        declarationAccepted: true
      }
    )
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Save to draft' })
    ).not.toBeInTheDocument()
  )
  expect(screen.getByTestId('document-tree')).toHaveAttribute(
    'data-read-only',
    'true'
  )
  expect(screen.getByLabelText('Evidence response')).toBeDisabled()
  expect(screen.getByText('Shared comments')).toBeInTheDocument()
})

test('failed saves preserve content and show an error', async ({
  render,
  app
}) => {
  api.put.mockRejectedValue(new Error('Network error'))
  render(<ProponentEOC designatedActionId="3" />, app)
  await screen.findByText('Organization: Example company')
  fireEvent.click(screen.getByRole('button', { name: 'Save to draft' }))
  await screen.findByText(/Unable to save evidence/)
  expect(screen.getByLabelText('Evidence response')).toHaveValue(
    'Existing evidence'
  )
})

test('government review locks disable draft edits and document management', async ({
  render,
  app
}) => {
  signer = true
  api.get.mockResolvedValue({
    data: {
      initiativeAgreementId: 2,
      iaCode: 'IA-2',
      actionNumber: 1,
      name: 'Install equipment',
      organizationName: 'Example company',
      status: 'Draft',
      daStatus: 'Approved',
      canEdit: false,
      content: { summary_of_work_completed: 'Existing evidence' },
      requirements: [{ id: 'summary_of_work_completed', title: 'Equipment' }]
    }
  })
  render(<ProponentEOC designatedActionId="3" />, app)
  await screen.findByText('Organization: Example company')
  expect(
    screen.queryByRole('button', { name: 'Save to draft' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Submit application' })
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Evidence response')).toBeDisabled()
  expect(screen.getByTestId('document-tree')).toHaveAttribute(
    'data-read-only',
    'true'
  )
  expect(screen.getByText('Shared comments')).toBeInTheDocument()
})

test('IDIR read-only evidence updates when the latest submitted package refetches', async ({
  render,
  app,
  query
}) => {
  let text = 'Initial submitted evidence'
  const payload = () => ({
    data: {
      initiativeAgreementId: 2,
      iaCode: 'IA-2',
      actionNumber: 1,
      name: 'Equipment',
      organizationName: 'Example',
      status: 'Draft',
      canEdit: true,
      content: { summary_of_work_completed: 'Mutable draft' },
      requirements: [
        { id: 'summary_of_work_completed', title: 'Summary of work completed' }
      ],
      submissions: [
        {
          id: 7,
          submittedAt: '2026-11-17T18:00:00Z',
          content: { summary_of_work_completed: text },
          requirements: [
            {
              id: 'summary_of_work_completed',
              title: 'Summary of work completed'
            }
          ],
          documents: [
            {
              documentId: 9,
              fileName: 'Original.pdf',
              folderPath: ['Original folder']
            }
          ]
        }
      ]
    }
  })
  api.get.mockImplementation(async () => payload())
  render(<ProponentEOC designatedActionId="3" readOnly />, app)
  await waitFor(() =>
    expect(screen.getAllByLabelText('Evidence response')[0]).toHaveValue(
      'Initial submitted evidence'
    )
  )
  expect(
    screen.getByRole('button', { name: 'Original.pdf' })
  ).toBeInTheDocument()
  text = 'Newly submitted evidence'
  await act(async () => {
    await query.client.invalidateQueries({
      queryKey: ['designated-action-eoc', '3']
    })
  })
  await waitFor(() =>
    expect(screen.getAllByLabelText('Evidence response')[0]).toHaveValue(
      'Newly submitted evidence'
    )
  )
  expect(screen.getAllByLabelText('Evidence response')[0]).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Original.pdf' })
  ).toBeInTheDocument()
})

test('a reopened revision requires a fresh signing declaration', async ({
  render,
  app,
  query
}) => {
  signer = true
  render(<ProponentEOC designatedActionId="3" />, app)
  await screen.findByText('Organization: Example company')
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Submit application' }))
  await waitFor(() =>
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  )
  submitted = false
  await act(async () => {
    await query.client.invalidateQueries({
      queryKey: ['designated-action-eoc', '3']
    })
  })
  expect(await screen.findByRole('checkbox')).not.toBeChecked()
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
})
