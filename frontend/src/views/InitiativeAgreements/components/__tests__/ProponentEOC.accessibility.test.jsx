import { screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, vi } from 'vite-plus/test'
import { test } from '@/tests/utils/fixtures'
import { ProponentEOC } from '../ProponentEOC'

const api = { get: vi.fn(), put: vi.fn(), post: vi.fn() }
vi.mock('@/services/useApiService', () => ({ useApiService: () => api }))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ hasRoles: () => true })
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

beforeEach(() => {
  Range.prototype.getBoundingClientRect ??= () => ({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0
  })
  Range.prototype.getClientRects ??= () => []
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
      content: { summary_of_work_completed: '' },
      requirements: [
        { id: 'summary_of_work_completed', title: 'Summary of work completed' }
      ]
    }
  })
})

test('names the actual Quill formatting toolbar and its controls', async ({
  render,
  app
}) => {
  render(<ProponentEOC designatedActionId="3" />, app)
  await screen.findByText('Example company')
  // The first evidence requirement is expanded by default, matching the Figma export.

  const textbox = await screen.findByRole('textbox', {
    name: 'Summary of work completed'
  })
  expect(textbox).toHaveAttribute('aria-multiline', 'true')

  const toolbar = await screen.findByRole('toolbar', {
    name: 'Summary of work completed formatting toolbar'
  })
  expect(toolbar.querySelector('.ql-bold')).toHaveAccessibleName('Bold')
  expect(toolbar.querySelector('.ql-italic')).toHaveAccessibleName('Italic')
  await waitFor(() => {
    expect(
      toolbar.querySelector('.ql-list[value="bullet"]')
    ).toHaveAccessibleName('Bulleted list')
    expect(
      toolbar.querySelector('.ql-list[value="ordered"]')
    ).toHaveAccessibleName('Numbered list')
    expect(toolbar.querySelector('.ql-link')).toHaveAccessibleName(
      'Insert link'
    )
  })
})
