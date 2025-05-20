import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import ImportDialog from '../ImportDialog'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, createTheme } from '@mui/material/styles'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (opts && opts.mode) return `${key} (${opts.mode})`
      if (opts && opts.fileName) return `${key} with fileName=${opts.fileName}`
      return key
    }
  })
}))

vi.mock('@/components/BCModal', () => {
  return {
    __esModule: true,
    default: ({ onClose, open, data }) => {
      if (!open) return null
      return (
        <div data-testid="bc-modal" data-test="bc-modal">
          <button
            data-testid="modal-close"
            data-test="modal-close"
            onClick={onClose}
          >
            X
          </button>
          {data.title && (
            <div data-testid="modal-title" data-test="modal-title">
              {data.title}
            </div>
          )}
          {data.content && (
            <div data-testid="modal-content" data-test="modal-content">
              {data.content}
            </div>
          )}
          {data.secondaryButtonAction && (
            <button
              data-testid="modal-secondary-action"
              data-test="modal-secondary-action"
              onClick={data.secondaryButtonAction}
            >
              {data.secondaryButtonText}
            </button>
          )}
        </div>
      )
    }
  }
})

vi.mock('@/components/BCTypography', () => ({
  __esModule: true,
  default: ({ children }) => (
    <div data-testid="bc-typography" data-test="bc-typography">
      {children}
    </div>
  )
}))

vi.mock('@/components/BCAlert', () => ({
  __esModule: true,
  default: ({ children, severity }) => (
    <div data-testid="bc-alert" data-test="bc-alert">
      {severity && (
        <div data-testid="bc-alert-severity" data-test="bc-alert-severity">
          {severity}
        </div>
      )}
      {children}
    </div>
  )
}))

vi.mock('@/components/BCBox', () => ({
  __esModule: true,
  default: ({ children }) => (
    <div data-testid="bc-box" data-test="bc-box">
      {children}
    </div>
  )
}))

vi.mock('@/constants/common.js', () => ({
  MAX_FILE_SIZE_BYTES: 10000 // 10KB for testing
}))

function createWrapper() {
  const queryClient = new QueryClient()
  const theme = createTheme()
  return ({ children }) => (
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  )
}

describe('ImportDialog Component', () => {
  let closeMock
  let mockImportHook
  let mockGetJobStatusHook

  beforeEach(() => {
    vi.clearAllMocks()
    closeMock = vi.fn()

    // The import hook returns an object with a mutate function.
    mockImportHook = vi.fn(() => ({
      mutate: vi.fn()
    }))

    // The job status hook returns data and a refetch function.
    mockGetJobStatusHook = vi.fn(() => ({
      data: null,
      refetch: vi.fn()
    }))
  })

  it('renders nothing when open=false', () => {
    render(
      <ImportDialog
        open={false}
        close={closeMock}
        complianceReportId={123}
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      { wrapper: createWrapper() }
    )
    expect(screen.queryByTestId('bc-modal')).not.toBeInTheDocument()
  })

  it('renders when open=true', () => {
    render(
      <ImportDialog
        open={true}
        close={closeMock}
        complianceReportId={123}
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      { wrapper: createWrapper() }
    )
    const modal = screen.getByTestId('bc-modal')
    expect(modal).toBeInTheDocument()
    expect(screen.getByTestId('modal-title').textContent).toContain(
      'common:importExport.import.dialog.title'
    )
  })

  it('calls close function when the modal is closed', () => {
    render(
      <ImportDialog
        open={true}
        close={closeMock}
        complianceReportId={123}
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      { wrapper: createWrapper() }
    )
    const secondaryBtn = screen.getByTestId('modal-secondary-action')
    fireEvent.click(secondaryBtn)
    expect(closeMock).toHaveBeenCalled()
  })

  it('allows selecting a file via the hidden input', async () => {
    const importHookResponse = { mutate: vi.fn() }
    mockImportHook.mockReturnValueOnce(importHookResponse)

    const { container } = render(
      <ImportDialog
        open={true}
        close={closeMock}
        complianceReportId={123}
        isOverwrite={true}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      { wrapper: createWrapper() }
    )
    const fileInput = container.querySelector('[data-test="file-input"]')
    expect(fileInput).toBeInTheDocument()

    const testFile = new File(['hello'], 'testfile.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    await waitFor(() => {
      expect(importHookResponse.mutate).toHaveBeenCalledTimes(1)
    })

    const [callArgs] = importHookResponse.mutate.mock.calls[0]
    expect(callArgs.file).toBe(testFile)
    expect(callArgs.isOverwrite).toBe(true)
  })

  it('shows an error if file is too large', async () => {
    const importHookResponse = { mutate: vi.fn() }
    mockImportHook.mockReturnValueOnce(importHookResponse)

    const { container } = render(
      <ImportDialog
        open={true}
        close={closeMock}
        complianceReportId={123}
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      { wrapper: createWrapper() }
    )
    const fileInput = container.querySelector('[data-test="file-input"]')
    const bigFile = new File([new ArrayBuffer(20000)], 'bigfile.csv', {
      type: 'text/csv'
    })
    fireEvent.change(fileInput, { target: { files: [bigFile] } })

    await waitFor(() => {
      expect(importHookResponse.mutate).not.toHaveBeenCalled()
    })

    expect(screen.getByTestId('bc-alert')).toBeInTheDocument()
    expect(screen.getByTestId('bc-alert-severity').textContent).toBe('error')
  })
})
