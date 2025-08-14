import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create minimal mocks to avoid heavy component rendering
vi.mock('@mui/material', () => ({
  FormControl: ({ children }) => <div role="group">{children}</div>,
  Select: ({ children, onChange, value, ...props }) => (
    <select
      role="combobox"
      value={value}
      onChange={(e) => onChange?.(e)}
      {...props}
    >
      {children}
    </select>
  ),
  MenuItem: ({ children, value, ...props }) => (
    <option value={value} {...props}>
      {children}
    </option>
  ),
  IconButton: ({ children, onClick, disabled, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Dialog: ({ open, children }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogActions: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogContentText: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <div>{children}</div>,
  Box: ({ children }) => <div>{children}</div>,
  Skeleton: () => <div>Loading...</div>
}))

vi.mock('@mui/icons-material', () => ({
  ContentCopy: () => <span>Copy</span>,
  Refresh: () => <span>Refresh</span>,
  AddCircleOutline: () => <span>Add</span>,
  Warning: () => <span>Warning</span>
}))

vi.mock('@/components/BCBox', () => ({
  default: ({ children }) => <div>{children}</div>
}))

vi.mock('@/components/BCButton', () => ({
  default: ({ children, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}))

vi.mock('@/components/BCTypography', () => ({
  default: ({ children }) => <span>{children}</span>
}))

vi.mock('@/components/BCAlert', () => ({
  default: ({ children }) => <div role="alert">{children}</div>
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key.split(':').pop() || key
  })
}))

vi.mock('@/utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true)
}))

// Test data
let formTypesData = { forms: { 1: { name: 'Form A', slug: 'form-a' } } }
let linkKeys = []
let refetchMock = vi.fn()

vi.mock('@/hooks/useOrganization', () => ({
  useAvailableFormTypes: vi.fn(() => ({
    data: formTypesData,
    isLoading: false
  })),
  useOrganizationLinkKeys: vi.fn(() => ({
    data: { linkKeys },
    isLoading: false,
    refetch: refetchMock
  })),
  useGenerateLinkKey: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false
  })),
  useRegenerateLinkKey: vi.fn(() => ({
    mutate: vi.fn(),
    isLoading: false
  }))
}))

import { LinkKeyManagement } from '../LinkKeyManagement'

const renderComponent = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
      mutations: { retry: false }
    }
  })
  return render(
    <QueryClientProvider client={client}>
      <LinkKeyManagement orgID={1} />
    </QueryClientProvider>
  )
}

describe('LinkKeyManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    linkKeys = []
    formTypesData = { forms: { 1: { name: 'Form A', slug: 'form-a' } } }
    refetchMock = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders basic elements', () => {
    renderComponent()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('shows form options when available', () => {
    renderComponent()
    expect(screen.getByRole('option', { name: 'Form A' })).toBeInTheDocument()
  })

  it('enables actions when form is selected', () => {
    renderComponent()
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '1' } })

    // Should enable the action button
    const buttons = screen.getAllByRole('button')
    expect(buttons.some((btn) => !btn.disabled)).toBe(true)
  })
})
