import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ThemeProvider } from '@mui/material'
import theme from '@/themes'
import { BulkActionButtons } from '../components/BulkActionButtons'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'chargingEquipment:submitSelected': 'Submit Selected',
        'chargingEquipment:setToDecommissioned': 'Set to Decommissioned'
      }
      return translations[key] || key
    }
  })
}))

const TestWrapper = ({ children }) => (
  <ThemeProvider theme={theme}>
    {children}
  </ThemeProvider>
)

describe('BulkActionButtons', () => {
  const mockOnSubmitClick = vi.fn()
  const mockOnDecommissionClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when no rows are selected', () => {
    render(
      <TestWrapper>
        <BulkActionButtons
          selectedRows={[]}
          canSubmit={false}
          canDecommission={false}
          onSubmitClick={mockOnSubmitClick}
          onDecommissionClick={mockOnDecommissionClick}
        />
      </TestWrapper>
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders submit button when can submit', () => {
    const selectedRows = [
      { status: 'Draft', charging_equipment_id: 1 },
      { status: 'Updated', charging_equipment_id: 2 },
      { status: 'Validated', charging_equipment_id: 3 }
    ]

    render(
      <TestWrapper>
        <BulkActionButtons
          selectedRows={selectedRows}
          canSubmit={true}
          canDecommission={false}
          onSubmitClick={mockOnSubmitClick}
          onDecommissionClick={mockOnDecommissionClick}
        />
      </TestWrapper>
    )

    const submitButton = screen.getByRole('button', { name: /Submit Selected \(2\)/ })
    expect(submitButton).toBeInTheDocument()
    
    fireEvent.click(submitButton)
    expect(mockOnSubmitClick).toHaveBeenCalledOnce()
  })

  it('renders decommission button when can decommission', () => {
    const selectedRows = [
      { status: 'Validated', charging_equipment_id: 1 },
      { status: 'Validated', charging_equipment_id: 2 },
      { status: 'Draft', charging_equipment_id: 3 }
    ]

    render(
      <TestWrapper>
        <BulkActionButtons
          selectedRows={selectedRows}
          canSubmit={false}
          canDecommission={true}
          onSubmitClick={mockOnSubmitClick}
          onDecommissionClick={mockOnDecommissionClick}
        />
      </TestWrapper>
    )

    const decommissionButton = screen.getByRole('button', { name: /Set to Decommissioned \(2\)/ })
    expect(decommissionButton).toBeInTheDocument()
    
    fireEvent.click(decommissionButton)
    expect(mockOnDecommissionClick).toHaveBeenCalledOnce()
  })

  it('renders both buttons when both actions are available', () => {
    const selectedRows = [
      { status: 'Draft', charging_equipment_id: 1 },
      { status: 'Validated', charging_equipment_id: 2 }
    ]

    render(
      <TestWrapper>
        <BulkActionButtons
          selectedRows={selectedRows}
          canSubmit={true}
          canDecommission={true}
          onSubmitClick={mockOnSubmitClick}
          onDecommissionClick={mockOnDecommissionClick}
        />
      </TestWrapper>
    )

    expect(screen.getByRole('button', { name: /Submit Selected \(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Set to Decommissioned \(1\)/ })).toBeInTheDocument()
  })

  it('counts only eligible items for submit action', () => {
    const selectedRows = [
      { status: 'Draft', charging_equipment_id: 1 },
      { status: 'Updated', charging_equipment_id: 2 },
      { status: 'Submitted', charging_equipment_id: 3 },
      { status: 'Validated', charging_equipment_id: 4 },
      { status: 'Decommissioned', charging_equipment_id: 5 }
    ]

    render(
      <TestWrapper>
        <BulkActionButtons
          selectedRows={selectedRows}
          canSubmit={true}
          canDecommission={false}
          onSubmitClick={mockOnSubmitClick}
          onDecommissionClick={mockOnDecommissionClick}
        />
      </TestWrapper>
    )

    // Should only count Draft and Updated statuses
    expect(screen.getByRole('button', { name: /Submit Selected \(2\)/ })).toBeInTheDocument()
  })

  it('counts only validated items for decommission action', () => {
    const selectedRows = [
      { status: 'Draft', charging_equipment_id: 1 },
      { status: 'Validated', charging_equipment_id: 2 },
      { status: 'Validated', charging_equipment_id: 3 },
      { status: 'Validated', charging_equipment_id: 4 },
      { status: 'Decommissioned', charging_equipment_id: 5 }
    ]

    render(
      <TestWrapper>
        <BulkActionButtons
          selectedRows={selectedRows}
          canSubmit={false}
          canDecommission={true}
          onSubmitClick={mockOnSubmitClick}
          onDecommissionClick={mockOnDecommissionClick}
        />
      </TestWrapper>
    )

    // Should only count Validated statuses
    expect(screen.getByRole('button', { name: /Set to Decommissioned \(3\)/ })).toBeInTheDocument()
  })
})