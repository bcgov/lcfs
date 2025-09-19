import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { BulkActionModals } from '../components/BulkActionModals'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      const translations = {
        'chargingEquipment:submitConfirmTitle': 'Submit Confirmation',
        'chargingEquipment:submitConfirmMessage': `This will set ${options?.count || 0} selected FSE to Submitted status.`,
        'chargingEquipment:submitConfirmWarning': 'No more edits will be possible.',
        'chargingEquipment:submitSelected': 'Submit Selected',
        'chargingEquipment:decommissionConfirmTitle': 'Decommission Confirmation',
        'chargingEquipment:decommissionConfirmMessage': `This will set ${options?.count || 0} selected FSE to Decommissioned status.`,
        'chargingEquipment:decommissionConfirmWarning': 'They will no longer be available in future compliance reports.',
        'chargingEquipment:setToDecommissioned': 'Set to Decommissioned',
        'common:cancel': 'Cancel'
      }
      return translations[key] || key
    }
  })
}))

// Mock BCModal component
vi.mock('@/components/BCModal', () => ({
  __esModule: true,
  default: ({ open, onClose, title, children }) => {
    if (!open) return null
    return (
      <div data-test="modal" role="dialog">
        <div data-test="modal-title">{title}</div>
        <button data-test="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    )
  }
}))

const TestWrapper = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
)

describe('BulkActionModals', () => {
  const mockOnSubmitConfirm = vi.fn()
  const mockOnDecommissionConfirm = vi.fn()
  const mockOnSubmitCancel = vi.fn()
  const mockOnDecommissionCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when both modals are closed', () => {
    render(
      <TestWrapper>
        <BulkActionModals
          showSubmitModal={false}
          showDecommissionModal={false}
          selectedCount={2}
          onSubmitConfirm={mockOnSubmitConfirm}
          onDecommissionConfirm={mockOnDecommissionConfirm}
          onSubmitCancel={mockOnSubmitCancel}
          onDecommissionCancel={mockOnDecommissionCancel}
          isSubmitting={false}
          isDecommissioning={false}
        />
      </TestWrapper>
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders submit modal when showSubmitModal is true', () => {
    render(
      <TestWrapper>
        <BulkActionModals
          showSubmitModal={true}
          showDecommissionModal={false}
          selectedCount={3}
          onSubmitConfirm={mockOnSubmitConfirm}
          onDecommissionConfirm={mockOnDecommissionConfirm}
          onSubmitCancel={mockOnSubmitCancel}
          onDecommissionCancel={mockOnDecommissionCancel}
          isSubmitting={false}
          isDecommissioning={false}
        />
      </TestWrapper>
    )

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Submit Confirmation')
    expect(screen.getByText(/This will set 3 selected FSE to Submitted status/)).toBeInTheDocument()
    expect(screen.getByText('No more edits will be possible.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit Selected' })).toBeInTheDocument()
  })

  it('renders decommission modal when showDecommissionModal is true', () => {
    render(
      <TestWrapper>
        <BulkActionModals
          showSubmitModal={false}
          showDecommissionModal={true}
          selectedCount={2}
          onSubmitConfirm={mockOnSubmitConfirm}
          onDecommissionConfirm={mockOnDecommissionConfirm}
          onSubmitCancel={mockOnSubmitCancel}
          onDecommissionCancel={mockOnDecommissionCancel}
          isSubmitting={false}
          isDecommissioning={false}
        />
      </TestWrapper>
    )

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Decommission Confirmation')
    expect(screen.getByText(/This will set 2 selected FSE to Decommissioned status/)).toBeInTheDocument()
    expect(screen.getByText('They will no longer be available in future compliance reports.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set to Decommissioned' })).toBeInTheDocument()
  })

  it('handles submit modal actions', () => {
    render(
      <TestWrapper>
        <BulkActionModals
          showSubmitModal={true}
          showDecommissionModal={false}
          selectedCount={1}
          onSubmitConfirm={mockOnSubmitConfirm}
          onDecommissionConfirm={mockOnDecommissionConfirm}
          onSubmitCancel={mockOnSubmitCancel}
          onDecommissionCancel={mockOnDecommissionCancel}
          isSubmitting={false}
          isDecommissioning={false}
        />
      </TestWrapper>
    )

    // Test cancel action
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockOnSubmitCancel).toHaveBeenCalledOnce()

    // Test confirm action
    fireEvent.click(screen.getByRole('button', { name: 'Submit Selected' }))
    expect(mockOnSubmitConfirm).toHaveBeenCalledOnce()
  })

  it('handles decommission modal actions', () => {
    render(
      <TestWrapper>
        <BulkActionModals
          showSubmitModal={false}
          showDecommissionModal={true}
          selectedCount={1}
          onSubmitConfirm={mockOnSubmitConfirm}
          onDecommissionConfirm={mockOnDecommissionConfirm}
          onSubmitCancel={mockOnSubmitCancel}
          onDecommissionCancel={mockOnDecommissionCancel}
          isSubmitting={false}
          isDecommissioning={false}
        />
      </TestWrapper>
    )

    // Test cancel action
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockOnDecommissionCancel).toHaveBeenCalledOnce()

    // Test confirm action
    fireEvent.click(screen.getByRole('button', { name: 'Set to Decommissioned' }))
    expect(mockOnDecommissionConfirm).toHaveBeenCalledOnce()
  })

  it('disables buttons when submitting', () => {
    render(
      <TestWrapper>
        <BulkActionModals
          showSubmitModal={true}
          showDecommissionModal={false}
          selectedCount={1}
          onSubmitConfirm={mockOnSubmitConfirm}
          onDecommissionConfirm={mockOnDecommissionConfirm}
          onSubmitCancel={mockOnSubmitCancel}
          onDecommissionCancel={mockOnDecommissionCancel}
          isSubmitting={true}
          isDecommissioning={false}
        />
      </TestWrapper>
    )

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    const submitButton = screen.getByRole('button', { name: 'Submit Selected' })

    expect(cancelButton).toBeDisabled()
    expect(submitButton).toBeDisabled()
  })

  it('disables buttons when decommissioning', () => {
    render(
      <TestWrapper>
        <BulkActionModals
          showSubmitModal={false}
          showDecommissionModal={true}
          selectedCount={1}
          onSubmitConfirm={mockOnSubmitConfirm}
          onDecommissionConfirm={mockOnDecommissionConfirm}
          onSubmitCancel={mockOnSubmitCancel}
          onDecommissionCancel={mockOnDecommissionCancel}
          isSubmitting={false}
          isDecommissioning={true}
        />
      </TestWrapper>
    )

    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    const decommissionButton = screen.getByRole('button', { name: 'Set to Decommissioned' })

    expect(cancelButton).toBeDisabled()
    expect(decommissionButton).toBeDisabled()
  })

  it('handles modal close via close button', () => {
    render(
      <TestWrapper>
        <BulkActionModals
          showSubmitModal={true}
          showDecommissionModal={false}
          selectedCount={1}
          onSubmitConfirm={mockOnSubmitConfirm}
          onDecommissionConfirm={mockOnDecommissionConfirm}
          onSubmitCancel={mockOnSubmitCancel}
          onDecommissionCancel={mockOnDecommissionCancel}
          isSubmitting={false}
          isDecommissioning={false}
        />
      </TestWrapper>
    )

    fireEvent.click(screen.getByTestId('modal-close'))
    expect(mockOnSubmitCancel).toHaveBeenCalledOnce()
  })

  it('shows both modals simultaneously if needed', () => {
    render(
      <TestWrapper>
        <BulkActionModals
          showSubmitModal={true}
          showDecommissionModal={true}
          selectedCount={1}
          onSubmitConfirm={mockOnSubmitConfirm}
          onDecommissionConfirm={mockOnDecommissionConfirm}
          onSubmitCancel={mockOnSubmitCancel}
          onDecommissionCancel={mockOnDecommissionCancel}
          isSubmitting={false}
          isDecommissioning={false}
        />
      </TestWrapper>
    )

    // Should have both modal titles
    const modals = screen.getAllByRole('dialog')
    expect(modals).toHaveLength(2)
    
    // Should have buttons for both actions
    expect(screen.getByRole('button', { name: 'Submit Selected' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set to Decommissioned' })).toBeInTheDocument()
  })
})