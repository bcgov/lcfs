import { render, screen, fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
import React from 'react'

import theme from '@/themes'
import { roles } from '@/constants/roles'
import { CommentLog } from '../CommentLog'

// ----- Mocks ---------------------------------------------------------

const baseHookState = () => ({
  filters: {
    category: null,
    complianceYear: null,
    dateFrom: null,
    dateTo: null,
    visibility: null,
    search: '',
    sortBy: 'create_date',
    sortOrder: 'desc',
    page: 1,
    size: 25
  },
  setFilter: vi.fn(),
  setFilters: vi.fn(),
  clearFilters: vi.fn(),
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn()
})

const mockHook = vi.fn(() => baseHookState())

vi.mock('@/hooks/useOrganizationComments', () => ({
  useOrganizationComments: (...args) => mockHook(...args),
  useCommentCategories: () => ({ data: [] }),
  useEditOrganizationComment: () => ({ mutate: vi.fn(), isPending: false })
}))

const mockUser = vi.fn(() => ({
  data: { organization: { organizationId: 123 } },
  hasRoles: (...rs) => rs.includes(roles.government)
}))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => mockUser()
}))

// Stub the filter bar to a single visible category select to keep
// component tests focused on rendering / pagination / sanitization.
vi.mock('../CommentLogFilters', () => ({
  CommentLogFilters: ({ isGovernment }) => (
    <div data-test="filters" data-government={String(isGovernment)} />
  )
}))

// ----- Helpers -------------------------------------------------------

const renderCommentLog = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <MemoryRouter>
            <CommentLog organizationId={123} />
          </MemoryRouter>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const sampleComment = (overrides = {}) => ({
  internalCommentId: 1,
  comment: '<p>Hello <strong>world</strong></p>',
  plainTextComment: 'Hello world',
  entityType: 'complianceReport',
  entityId: 10,
  category: 'Compliance notes',
  complianceYear: 2024,
  organizationId: 123,
  organizationName: 'LCFS Org 1',
  visibility: 'Internal',
  audienceScope: 'Analyst',
  createUser: 'analyst1',
  fullName: 'Guy Analyst',
  createDate: '2025-03-27T10:40:54Z',
  updateDate: '2025-03-27T10:40:54Z',
  canEdit: false,
  ...overrides
})

// ----- Tests ---------------------------------------------------------

describe('CommentLog', () => {
  beforeEach(() => {
    mockHook.mockReset()
    mockHook.mockImplementation(() => baseHookState())
    mockUser.mockReset()
    mockUser.mockImplementation(() => ({
      data: { organization: { organizationId: 123 } },
      hasRoles: (...rs) => rs.includes(roles.government)
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading skeleton while fetching', () => {
    mockHook.mockReturnValue({ ...baseHookState(), isLoading: true })
    renderCommentLog()
    expect(screen.getByTestId('comment-log-loading')).toBeInTheDocument()
  })

  it('renders empty state when there are no results', () => {
    mockHook.mockReturnValue({
      ...baseHookState(),
      data: {
        comments: [],
        pagination: { page: 1, size: 25, total: 0, totalPages: 0 }
      }
    })
    renderCommentLog()
    expect(screen.getByTestId('comment-log-empty')).toBeInTheDocument()
  })

  it('renders an error state with a Retry button that triggers refetch', () => {
    const refetch = vi.fn()
    mockHook.mockReturnValue({
      ...baseHookState(),
      isError: true,
      error: new Error('boom'),
      refetch
    })
    renderCommentLog()
    const err = screen.getByTestId('comment-log-error')
    expect(err).toBeInTheDocument()
    fireEvent.click(within(err).getByRole('button', { name: /retry/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('renders rows with sanitized HTML (script tags stripped)', () => {
    mockHook.mockReturnValue({
      ...baseHookState(),
      data: {
        comments: [
          sampleComment({
            internalCommentId: 99,
            comment:
              '<p>Safe <strong>bold</strong></p><script>window.__pwned = true</script>'
          })
        ],
        pagination: { page: 1, size: 25, total: 1, totalPages: 1 }
      }
    })
    renderCommentLog()
    const row = screen.getByTestId('comment-log-item-99')
    const body = within(row).getByTestId('comment-body')
    expect(body.innerHTML).toContain('<strong>bold</strong>')
    expect(body.innerHTML).not.toContain('<script')
    expect(window.__pwned).toBeUndefined()
  })

  it('renders consecutive comments from the same entity without reordering them', () => {
    mockHook.mockReturnValue({
      ...baseHookState(),
      data: {
        comments: [
          sampleComment({
            internalCommentId: 1,
            entityType: 'initiativeAgreement',
            entityId: 77,
            comment: '<p>First IA comment</p>'
          }),
          sampleComment({
            internalCommentId: 2,
            entityType: 'initiativeAgreement',
            entityId: 77,
            comment: '<p>Second IA comment</p>'
          }),
          sampleComment({
            internalCommentId: 3,
            entityType: 'Transfer',
            entityId: 88,
            comment: '<p>Transfer comment</p>'
          })
        ],
        pagination: { page: 1, size: 25, total: 3, totalPages: 1 }
      }
    })

    renderCommentLog()

    const rows = screen.getAllByTestId('comment-log-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('First IA comment')
    expect(rows[1]).toHaveTextContent('Second IA comment')
    expect(rows[2]).toHaveTextContent('Transfer comment')
  })

  it('shows the Internal badge for government callers', () => {
    mockHook.mockReturnValue({
      ...baseHookState(),
      data: {
        comments: [sampleComment()],
        pagination: { page: 1, size: 25, total: 1, totalPages: 1 }
      }
    })
    renderCommentLog()
    expect(screen.getByTestId('comment-internal-badge')).toBeInTheDocument()
  })

  it('hides the Internal badge for BCeID callers', () => {
    mockUser.mockReturnValue({
      data: { organization: { organizationId: 123 } },
      hasRoles: () => false
    })
    mockHook.mockReturnValue({
      ...baseHookState(),
      data: {
        comments: [sampleComment({ visibility: 'Internal' })],
        pagination: { page: 1, size: 25, total: 1, totalPages: 1 }
      }
    })
    renderCommentLog()
    expect(
      screen.queryByTestId('comment-internal-badge')
    ).not.toBeInTheDocument()
  })

  it('renders an edited indicator when update_date differs from create_date', () => {
    mockHook.mockReturnValue({
      ...baseHookState(),
      data: {
        comments: [
          sampleComment({
            createDate: '2025-03-27T10:40:54Z',
            updateDate: '2025-04-09T11:56:59Z'
          })
        ],
        pagination: { page: 1, size: 25, total: 1, totalPages: 1 }
      }
    })
    renderCommentLog()
    expect(screen.getByTestId('comment-edited-indicator')).toBeInTheDocument()
  })

  it('renders pagination when totalPages > 1 and changing page calls setFilters', () => {
    const setFilters = vi.fn()
    mockHook.mockReturnValue({
      ...baseHookState(),
      setFilters,
      data: {
        comments: [sampleComment()],
        pagination: { page: 1, size: 25, total: 50, totalPages: 2 }
      }
    })
    renderCommentLog()
    const pagination = screen.getByTestId('comment-log-pagination')
    fireEvent.click(
      within(pagination).getByRole('button', { name: 'Go to page 2' })
    )
    expect(setFilters).toHaveBeenCalledWith({ page: 2 })
  })
})
