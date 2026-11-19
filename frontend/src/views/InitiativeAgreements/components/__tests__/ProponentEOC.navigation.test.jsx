import { fireEvent, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom'
import { beforeEach, expect, vi } from 'vite-plus/test'
import { test } from '@/tests/utils/fixtures'
import { ProponentEOC } from '../ProponentEOC'

const api = { get: vi.fn(), put: vi.fn(), post: vi.fn() }
vi.mock('@/services/useApiService', () => ({ useApiService: () => api }))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ hasRoles: () => true })
}))
vi.mock('../DocumentTree', () => ({ DocumentTree: () => null }))
vi.mock('@/components/Comments', () => ({ default: () => null }))
vi.mock('@/components/Documents/DocumentUploadDialog', () => ({
  default: () => null
}))
vi.mock('react-quill', () => ({
  default: ({ value, onChange }) => (
    <textarea
      aria-label="Evidence response"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({
    data: {
      initiativeAgreementId: 2,
      iaCode: 'IA-2',
      actionNumber: 1,
      name: 'Install equipment',
      organizationName: 'Example company',
      status: 'Draft',
      canEdit: true,
      content: { summary_of_work_completed: 'Existing evidence' },
      requirements: [{ id: 'summary_of_work_completed', title: 'Equipment' }]
    }
  })
  api.put.mockImplementation(async (_url, body) => ({
    data: {
      initiativeAgreementId: 2,
      iaCode: 'IA-2',
      actionNumber: 1,
      name: 'Install equipment',
      organizationName: 'Example company',
      status: 'Draft',
      canEdit: true,
      content: {
        summary_of_work_completed: body.summaryOfWorkCompleted,
        how_evidence_meets_agreement_requirements:
          body.howEvidenceMeetsAgreementRequirements,
        exceptions_limitations_and_context: body.exceptionsLimitationsAndContext
      },
      requirements: [{ id: 'summary_of_work_completed', title: 'Equipment' }]
    }
  }))
})

test('in-app navigation waits for the user to save or discard dirty evidence', async ({
  render,
  app
}) => {
  const router = createMemoryRouter(
    [
      {
        path: '/eoc',
        element: (
          <>
            <ProponentEOC designatedActionId="3" />
            <Link to="/next">Open another page</Link>
          </>
        )
      },
      { path: '/next', element: <p>Another page</p> }
    ],
    { initialEntries: ['/eoc'] }
  )
  const routerProvider = {
    kind: 'router',
    wrap: () => <RouterProvider router={router} />
  }
  render(<></>, [
    ...app.filter(({ kind }) => kind !== 'router'),
    routerProvider
  ])
  await screen.findByText('Organization: Example company')
  fireEvent.change(screen.getByLabelText('Evidence response'), {
    target: { value: 'Unsaved update' }
  })
  fireEvent.click(screen.getByRole('link', { name: 'Open another page' }))

  expect(
    await screen.findByRole('dialog', { name: 'Unsaved evidence changes' })
  ).toBeInTheDocument()
  expect(screen.queryByText('Another page')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Stay on page' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  fireEvent.click(screen.getByRole('link', { name: 'Open another page' }))
  await screen.findByRole('dialog', { name: 'Unsaved evidence changes' })
  fireEvent.click(screen.getByRole('button', { name: 'Save and leave' }))

  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(await screen.findByText('Another page')).toBeInTheDocument()
})
