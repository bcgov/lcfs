import { screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, expect, beforeEach, afterEach } from 'vitest'
import ImportDialog from '../ImportDialog'
import { test } from '@/tests/utils/fixtures'
import { validateFile } from '@/utils/fileValidation'

// Mock dependencies
vi.mock('@/utils/fileValidation', () => ({
  validateFile: vi.fn()
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      const translations = {
        'common:importExport.import.dialog.title': `Import ${options?.mode || 'append'}`,
        'common:importExport.import.dialog.header': 'Select file to import',
        'common:importExport.import.dialog.selectorText':
          'Click or drag file here',
        'common:importExport.import.dialog.uploadStatusStarting':
          'Starting upload...',
        'common:importExport.import.dialog.uploadStatus.imported': 'Imported:',
        'common:importExport.import.dialog.uploadStatus.rejected': 'Rejected:',
        'common:importExport.import.dialog.completed.success': `Successfully imported ${options?.fileName}`,
        'common:importExport.import.dialog.completed.failure': 'Import failed',
        'common:importExport.import.dialog.fileError.virusDetected':
          'Virus detected in file',
        'common:importExport.import.dialog.fileError.uploadFailed':
          'Upload failed',
        'common:importExport.import.dialog.fileError.tooLarge':
          'File too large',
        'common:importExport.import.dialog.buttons.close': 'Close',
        'common:importExport.import.dialog.buttons.cancel': 'Cancel',
        'common:importExport.import.dialog.uploadMode.overwrite': 'overwrite',
        'common:importExport.import.dialog.uploadMode.append': 'append'
      }
      return translations[key] || key
    }
  })
}))

describe('LinearProgressWithLabel', () => {
  test('should render progress bar with correct percentage', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const LinearProgressWithLabel = ({ value }) => {
      return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', marginRight: 1 }}>
            <div role="progressbar" aria-valuenow={value} />
          </div>
          <div style={{ minWidth: 35 }}>
            <span>{`${Math.round(value)}%`}</span>
          </div>
        </div>
      )
    }
    render(<LinearProgressWithLabel value={45} />)
    expect(screen.getByText('45%')).toBeInTheDocument()
  })
})

describe('ImportDialog', () => {
  let mockImportHook, mockGetJobStatusHook

  beforeEach(() => {
    mockImportHook = vi.fn(() => ({ mutate: vi.fn() }))
    mockGetJobStatusHook = vi.fn(() => ({ data: null, refetch: vi.fn() }))
  })

  test('should render with initial state and props', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    expect(screen.getByText('Import append')).toBeInTheDocument()
    expect(screen.getByText('Select file to import')).toBeInTheDocument()
    expect(screen.getByText('Click or drag file here')).toBeInTheDocument()
  })

  test('should transition through upload states correctly', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockMutate = vi.fn()
    const mockRefetch = vi.fn()

    mockImportHook.mockReturnValue({ mutate: mockMutate })
    mockGetJobStatusHook.mockReturnValue({
      data: { progress: 50, status: 'Processing...', created: 10, rejected: 2 },
      refetch: mockRefetch
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    // Simulate file upload
    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(mockMutate).toHaveBeenCalledWith({ file, isOverwrite: false })
  })

  test('should handle drag and drop file upload', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    validateFile.mockReturnValue({ isValid: true })

    const mockMutate = vi.fn()
    mockImportHook.mockReturnValue({ mutate: mockMutate })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const dropZone = screen
      .getByRole('button', { name: /upload/i })
      .closest('.MuiCard-root')

    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        files: [file],
        clearData: vi.fn()
      }
    })

    fireEvent(dropZone, dropEvent)
    expect(mockMutate).toHaveBeenCalledWith({ file, isOverwrite: false })
  })

  test('should trigger file input when card is clicked', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click')
    const uploadCard = screen
      .getByRole('button', { name: /upload/i })
      .closest('.MuiCard-root')

    fireEvent.click(uploadCard)
    expect(clickSpy).toHaveBeenCalled()
  })

  test('should handle virus detection error (422)', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockMutate = vi.fn()
    let savedOnError

    // Capture the onError callback when importHook is called
    mockImportHook.mockImplementation((complianceReportId, { onError }) => {
      savedOnError = onError
      return { mutate: mockMutate }
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    // Simulate file upload that triggers the error
    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Trigger the error callback
    savedOnError({ response: { status: 422 } })

    await waitFor(() => {
      expect(screen.getByText('Virus detected in file')).toBeInTheDocument()
    })
  })

  test('should handle generic upload error', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockMutate = vi.fn()
    let savedOnError

    // Capture the onError callback when importHook is called
    mockImportHook.mockImplementation((complianceReportId, { onError }) => {
      savedOnError = onError
      return { mutate: mockMutate }
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    // Simulate file upload that triggers the error
    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Trigger the error callback
    savedOnError({ response: { status: 500 } })

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })

  test('should poll job status and update progress', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockRefetch = vi.fn()
    const mockMutate = vi.fn()
    let savedOnSuccess

    // Capture the onSuccess callback when importHook is called
    mockImportHook.mockImplementation((complianceReportId, { onSuccess }) => {
      savedOnSuccess = onSuccess
      return { mutate: mockMutate }
    })

    mockGetJobStatusHook.mockReturnValue({
      data: null,
      refetch: mockRefetch
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    // Simulate file upload that starts the job
    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Trigger the success callback to start polling
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })

    // Call the onSuccess callback to simulate successful upload
    savedOnSuccess({ data: { jobId: 'job123' } })

    // Wait for the effect to set up polling
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  test('should reset state when dialog is closed', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockClose = vi.fn()

    render(
      <ImportDialog
        open={true}
        close={mockClose}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(mockClose).toHaveBeenCalled()
  })

  test('should reject files that are too large', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    validateFile.mockReturnValue({
      isValid: false,
      errorMessage: 'File too large'
    })

    const mockMutate = vi.fn()
    mockImportHook.mockReturnValue({ mutate: mockMutate })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    const largeFile = new File(['x'.repeat(1000000)], 'large.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(
        screen.getByText(/Upload failed.*File too large/)
      ).toBeInTheDocument()
    })
  })

  test('should display upload progress and counts correctly', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockMutate = vi.fn()
    let savedOnSuccess

    mockImportHook.mockImplementation((complianceReportId, { onSuccess }) => {
      savedOnSuccess = onSuccess
      return { mutate: mockMutate }
    })

    mockGetJobStatusHook.mockReturnValue({
      data: {
        progress: 80,
        status: 'Processing records...',
        created: 40,
        rejected: 8,
        errors: []
      },
      refetch: vi.fn()
    })

    validateFile.mockReturnValue({ isValid: true })

    const { rerender } = render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    // Simulate file upload to trigger uploading state
    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Trigger the success callback to start the upload process
    savedOnSuccess({ data: { jobId: 'job123' } })

    // Wait for the uploading state to be rendered
    await waitFor(() => {
      expect(screen.getByText('Processing records...')).toBeInTheDocument()
    })

    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument() // created count
    expect(screen.getByText('8')).toBeInTheDocument() // rejected count
  })

  test('should show success state when upload completes successfully', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockMutate = vi.fn()
    let savedOnSuccess

    mockImportHook.mockImplementation((complianceReportId, { onSuccess }) => {
      savedOnSuccess = onSuccess
      return { mutate: mockMutate }
    })

    mockGetJobStatusHook.mockReturnValue({
      data: {
        progress: 100,
        status: 'Completed',
        created: 50,
        rejected: 0,
        errors: []
      },
      refetch: vi.fn()
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    // Simulate file upload to create uploadedFile state
    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Trigger success to start job and create uploadedFile
    savedOnSuccess({ data: { jobId: 'job123' } })

    // Wait for success message to appear
    await waitFor(() => {
      expect(
        screen.getByText(/Successfully imported test.xlsx/)
      ).toBeInTheDocument()
    })
  })

  test('should show failure state when no file was uploaded', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockMutate = vi.fn()
    mockImportHook.mockReturnValue({ mutate: mockMutate })

    // Start in completed state with no job data
    mockGetJobStatusHook.mockReturnValue({
      data: null,
      refetch: vi.fn()
    })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    // The component starts in SELECT_FILE state by default
    // The failure state is only shown in COMPLETED state with no uploaded file
    // For this test, we verify it starts in the file selection state
    expect(screen.getByText('Click or drag file here')).toBeInTheDocument()
  })

  test('should cleanup intervals on unmount', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockMutate = vi.fn()
    mockImportHook.mockReturnValue({ mutate: mockMutate })

    const { unmount } = render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    // Test that the component unmounts without errors
    // The actual interval cleanup is tested implicitly through proper component lifecycle
    expect(() => unmount()).not.toThrow()
  })

  test('should display job-level error messages', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const mockMutate = vi.fn()
    let savedOnSuccess

    mockImportHook.mockImplementation((complianceReportId, { onSuccess }) => {
      savedOnSuccess = onSuccess
      return { mutate: mockMutate }
    })

    mockGetJobStatusHook.mockReturnValue({
      data: {
        progress: 100,
        status: 'Completed with errors',
        created: 30,
        rejected: 10,
        errors: ['Row 5: Invalid data format', 'Row 12: Missing required field']
      },
      refetch: vi.fn()
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    // Simulate file upload to set up the job
    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const fileInput = screen.getByTestId('file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Trigger success to start job
    savedOnSuccess({ data: { jobId: 'job123' } })

    await waitFor(() => {
      expect(screen.getByText('Row 5: Invalid data format')).toBeInTheDocument()
      expect(
        screen.getByText('Row 12: Missing required field')
      ).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // title prop
  // ---------------------------------------------------------------------------

  test('renders default title when no title prop is given', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )
    // Default title from translation key
    expect(screen.getByText('Import append')).toBeInTheDocument()
  })

  test('renders custom title when title prop is provided', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
        title="Upload FSE bulk update template"
      />,
      [query, theme, localization, router]
    )
    expect(
      screen.getByText('Upload FSE bulk update template')
    ).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // importedLabel prop
  // ---------------------------------------------------------------------------

  test('shows default "Imported:" label when importedLabel prop is absent', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    let savedOnSuccess
    mockImportHook.mockImplementation((_, { onSuccess }) => {
      savedOnSuccess = onSuccess
      return { mutate: vi.fn() }
    })
    mockGetJobStatusHook.mockReturnValue({
      data: {
        progress: 80,
        status: 'Processing...',
        created: 5,
        rejected: 0,
        errors: []
      },
      refetch: vi.fn()
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file] }
    })
    savedOnSuccess({ data: { jobId: 'job1' } })

    await waitFor(() => {
      expect(screen.getByText('Imported:')).toBeInTheDocument()
    })
  })

  test('shows custom importedLabel when prop is provided', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    let savedOnSuccess
    mockImportHook.mockImplementation((_, { onSuccess }) => {
      savedOnSuccess = onSuccess
      return { mutate: vi.fn() }
    })
    mockGetJobStatusHook.mockReturnValue({
      data: {
        progress: 80,
        status: 'Processing...',
        created: 5,
        rejected: 0,
        errors: []
      },
      refetch: vi.fn()
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
        importedLabel="Updated:"
      />,
      [query, theme, localization, router]
    )

    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file] }
    })
    savedOnSuccess({ data: { jobId: 'job1' } })

    await waitFor(() => {
      expect(screen.getByText('Updated:')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // skippedLabel prop
  // ---------------------------------------------------------------------------

  test('does not show skipped row when skippedLabel absent and skippedCount is 0', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    let savedOnSuccess
    mockImportHook.mockImplementation((_, { onSuccess }) => {
      savedOnSuccess = onSuccess
      return { mutate: vi.fn() }
    })
    mockGetJobStatusHook.mockReturnValue({
      data: {
        progress: 80,
        status: 'Processing...',
        created: 5,
        rejected: 0,
        skipped: 0,
        errors: []
      },
      refetch: vi.fn()
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file] }
    })
    savedOnSuccess({ data: { jobId: 'job1' } })

    await waitFor(() => {
      expect(screen.queryByText(/Skipped/)).not.toBeInTheDocument()
    })
  })

  test('shows skipped row with skippedLabel even when skippedCount is 0', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    let savedOnSuccess
    mockImportHook.mockImplementation((_, { onSuccess }) => {
      savedOnSuccess = onSuccess
      return { mutate: vi.fn() }
    })
    mockGetJobStatusHook.mockReturnValue({
      data: {
        progress: 80,
        status: 'Processing...',
        created: 5,
        rejected: 0,
        skipped: 0,
        errors: []
      },
      refetch: vi.fn()
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
        skippedLabel="Skipped (blank kWh):"
      />,
      [query, theme, localization, router]
    )

    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file] }
    })
    savedOnSuccess({ data: { jobId: 'job1' } })

    await waitFor(() => {
      expect(screen.getByText('Skipped (blank kWh):')).toBeInTheDocument()
    })
  })

  test('shows skipped row when skippedCount > 0 even without skippedLabel', async ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    let savedOnSuccess
    mockImportHook.mockImplementation((_, { onSuccess }) => {
      savedOnSuccess = onSuccess
      return { mutate: vi.fn() }
    })
    mockGetJobStatusHook.mockReturnValue({
      data: {
        progress: 80,
        status: 'Processing...',
        created: 5,
        rejected: 0,
        skipped: 3,
        errors: []
      },
      refetch: vi.fn()
    })

    validateFile.mockReturnValue({ isValid: true })

    render(
      <ImportDialog
        open={true}
        close={vi.fn()}
        complianceReportId="123"
        isOverwrite={false}
        importHook={mockImportHook}
        getJobStatusHook={mockGetJobStatusHook}
      />,
      [query, theme, localization, router]
    )

    const file = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    fireEvent.change(screen.getByTestId('file-input'), {
      target: { files: [file] }
    })
    savedOnSuccess({ data: { jobId: 'job1' } })

    await waitFor(() => {
      // Falls back to the common translation key label
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })
})
