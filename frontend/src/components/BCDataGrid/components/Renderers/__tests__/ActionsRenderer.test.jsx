import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ActionsRenderer } from '../ActionsRenderer'

// Mock BCTypography
vi.mock('@/components/BCTypography', () => ({
  default: ({ children, variant, ...props }) => (
    <div data-test="bc-typography" data-variant={variant} {...props}>
      {children}
    </div>
  )
}))

// Mock Material-UI icons
vi.mock('@mui/icons-material', () => ({
  Cancel: () => <div data-test="cancel-icon" />,
  Delete: () => <div data-test="delete-icon" />,
  Edit: () => <div data-test="edit-icon" />,
  Queue: () => <div data-test="queue-icon" />,
  Replay: () => <div data-test="replay-icon" />
}))

describe('ActionsRenderer', () => {
  let mockApi
  let mockNode
  let defaultProps

  beforeEach(() => {
    mockApi = {
      getEditingCells: vi.fn(() => []),
      startEditingCell: vi.fn(),
      stopEditing: vi.fn(),
      getDisplayedCenterColumns: vi.fn(() => [
        { colId: 'col1' },
        { colId: 'col2' },
        { colId: 'col3' }
      ])
    }

    mockNode = {
      rowIndex: 5
    }

    defaultProps = {
      api: mockApi,
      node: mockNode,
      data: { validationStatus: 'valid' },
      enableDuplicate: false,
      enableEdit: false,
      enableDelete: false,
      enableUndo: false,
      enableStatus: false
    }
  })

  describe('Basic rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<ActionsRenderer {...defaultProps} />)
      expect(container.querySelector('.MuiStack-root')).toBeInTheDocument()
    })

    it('should render empty when no buttons are enabled', () => {
      const { container } = render(<ActionsRenderer {...defaultProps} />)
      const stack = container.querySelector('.MuiStack-root')
      expect(stack.children).toHaveLength(0)
    })
  })

  describe('isCurrentRowEditing calculation', () => {
    it('should show edit button when no cells are editing', () => {
      mockApi.getEditingCells.mockReturnValue([])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      expect(mockApi.getEditingCells).toHaveBeenCalled()
      expect(screen.getByLabelText('edit row')).toBeInTheDocument()
    })

    it('should show cancel button when current row is editing', () => {
      mockApi.getEditingCells.mockReturnValue([{ rowIndex: 5 }])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      expect(mockApi.getEditingCells).toHaveBeenCalled()
      expect(screen.getByLabelText('cancel modification')).toBeInTheDocument()
      expect(screen.queryByLabelText('edit row')).not.toBeInTheDocument()
    })

    it('should show edit button when different row is editing', () => {
      mockApi.getEditingCells.mockReturnValue([{ rowIndex: 3 }])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      expect(mockApi.getEditingCells).toHaveBeenCalled()
      expect(screen.getByLabelText('edit row')).toBeInTheDocument()
      expect(screen.queryByLabelText('cancel modification')).not.toBeInTheDocument()
    })
  })

  describe('Duplicate button', () => {
    it('should render duplicate button when enabled', () => {
      render(
        <ActionsRenderer
          {...defaultProps}
          enableDuplicate={true}
        />
      )
      
      expect(screen.getByLabelText('copy the data to new row')).toBeInTheDocument()
    })

    it('should not render duplicate button when disabled', () => {
      render(<ActionsRenderer {...defaultProps} />)
      expect(screen.queryByLabelText('copy the data to new row')).not.toBeInTheDocument()
    })

    it('should disable duplicate button when validation status is error', () => {
      render(
        <ActionsRenderer
          {...defaultProps}
          enableDuplicate={true}
          data={{ validationStatus: 'error' }}
        />
      )
      
      const duplicateButton = screen.getByLabelText('copy the data to new row')
      expect(duplicateButton).toBeDisabled()
    })

    it('should enable duplicate button when validation status is valid', () => {
      render(
        <ActionsRenderer
          {...defaultProps}
          enableDuplicate={true}
          data={{ validationStatus: 'valid' }}
        />
      )
      
      const duplicateButton = screen.getByLabelText('copy the data to new row')
      expect(duplicateButton).not.toBeDisabled()
    })
  })

  describe('Edit button', () => {
    it('should render edit button when enabled and not editing', () => {
      mockApi.getEditingCells.mockReturnValue([])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      expect(screen.getByLabelText('edit row')).toBeInTheDocument()
    })

    it('should not render edit button when disabled', () => {
      render(<ActionsRenderer {...defaultProps} />)
      expect(screen.queryByLabelText('edit row')).not.toBeInTheDocument()
    })

    it('should not render edit button when current row is editing', () => {
      mockApi.getEditingCells.mockReturnValue([{ rowIndex: 5 }])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      expect(screen.queryByLabelText('edit row')).not.toBeInTheDocument()
    })

    it('should call api.startEditingCell when clicked', () => {
      mockApi.getEditingCells.mockReturnValue([])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      const editButton = screen.getByLabelText('edit row')
      fireEvent.click(editButton)
      
      expect(mockApi.startEditingCell).toHaveBeenCalledWith({
        rowIndex: 5,
        colKey: 'col3'
      })
    })
  })

  describe('Delete button', () => {
    it('should render delete button when enabled', () => {
      render(
        <ActionsRenderer
          {...defaultProps}
          enableDelete={true}
        />
      )
      
      expect(screen.getByLabelText('delete row')).toBeInTheDocument()
    })

    it('should not render delete button when disabled', () => {
      render(<ActionsRenderer {...defaultProps} />)
      expect(screen.queryByLabelText('delete row')).not.toBeInTheDocument()
    })
  })

  describe('Cancel button', () => {
    it('should render cancel button when editing', () => {
      mockApi.getEditingCells.mockReturnValue([{ rowIndex: 5 }])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      expect(screen.getByLabelText('cancel modification')).toBeInTheDocument()
    })

    it('should not render cancel button when not editing', () => {
      mockApi.getEditingCells.mockReturnValue([])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      expect(screen.queryByLabelText('cancel modification')).not.toBeInTheDocument()
    })

    it('should not render cancel button when edit disabled', () => {
      mockApi.getEditingCells.mockReturnValue([{ rowIndex: 5 }])
      render(<ActionsRenderer {...defaultProps} />)
      
      expect(screen.queryByLabelText('cancel modification')).not.toBeInTheDocument()
    })

    it('should call api.stopEditing when clicked', () => {
      mockApi.getEditingCells.mockReturnValue([{ rowIndex: 5 }])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      const cancelButton = screen.getByLabelText('cancel modification')
      fireEvent.click(cancelButton)
      
      expect(mockApi.stopEditing).toHaveBeenCalledWith(true)
    })
  })

  describe('Undo button', () => {
    it('should render undo button when enabled', () => {
      render(
        <ActionsRenderer
          {...defaultProps}
          enableUndo={true}
        />
      )
      
      expect(screen.getByLabelText('undo row')).toBeInTheDocument()
    })

    it('should not render undo button when disabled', () => {
      render(<ActionsRenderer {...defaultProps} />)
      expect(screen.queryByLabelText('undo row')).not.toBeInTheDocument()
    })
  })

  describe('Status display', () => {
    it('should render status text when provided', () => {
      const { container } = render(
        <ActionsRenderer
          {...defaultProps}
          enableStatus="Active"
        />
      )
      
      expect(container.querySelector('[data-test="bc-typography"]')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('should not render status when false', () => {
      const { container } = render(<ActionsRenderer {...defaultProps} />)
      expect(container.querySelector('[data-test="bc-typography"]')).not.toBeInTheDocument()
    })

    it('should not render status when empty string', () => {
      const { container } = render(
        <ActionsRenderer
          {...defaultProps}
          enableStatus=""
        />
      )
      
      expect(container.querySelector('[data-test="bc-typography"]')).not.toBeInTheDocument()
    })

    it('should render status with correct variant', () => {
      const { container } = render(
        <ActionsRenderer
          {...defaultProps}
          enableStatus="Processing"
        />
      )
      
      const typography = container.querySelector('[data-test="bc-typography"]')
      expect(typography).toHaveAttribute('data-variant', 'body2')
    })
  })

  describe('Multiple buttons', () => {
    it('should render multiple buttons when enabled', () => {
      mockApi.getEditingCells.mockReturnValue([])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableDuplicate={true}
          enableEdit={true}
          enableDelete={true}
          enableUndo={true}
          enableStatus="Active"
        />
      )
      
      expect(screen.getByLabelText('copy the data to new row')).toBeInTheDocument()
      expect(screen.getByLabelText('edit row')).toBeInTheDocument()
      expect(screen.getByLabelText('delete row')).toBeInTheDocument()
      expect(screen.getByLabelText('undo row')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('should handle edit/cancel button toggling', () => {
      mockApi.getEditingCells.mockReturnValue([{ rowIndex: 5 }])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableDuplicate={true}
          enableEdit={true}
          enableDelete={true}
          enableUndo={true}
          enableStatus="Editing"
        />
      )
      
      expect(screen.getByLabelText('copy the data to new row')).toBeInTheDocument()
      expect(screen.queryByLabelText('edit row')).not.toBeInTheDocument()
      expect(screen.getByLabelText('cancel modification')).toBeInTheDocument()
      expect(screen.getByLabelText('delete row')).toBeInTheDocument()
      expect(screen.getByLabelText('undo row')).toBeInTheDocument()
      expect(screen.getByText('Editing')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper aria-labels for all buttons', () => {
      mockApi.getEditingCells.mockReturnValue([])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableDuplicate={true}
          enableEdit={true}
          enableDelete={true}
          enableUndo={true}
        />
      )
      
      expect(screen.getByLabelText('copy the data to new row')).toBeInTheDocument()
      expect(screen.getByLabelText('edit row')).toBeInTheDocument()
      expect(screen.getByLabelText('delete row')).toBeInTheDocument()
      expect(screen.getByLabelText('undo row')).toBeInTheDocument()
    })

    it('should maintain accessibility when editing', () => {
      mockApi.getEditingCells.mockReturnValue([{ rowIndex: 5 }])
      render(
        <ActionsRenderer
          {...defaultProps}
          enableEdit={true}
        />
      )
      
      expect(screen.getByLabelText('cancel modification')).toBeInTheDocument()
    })
  })
})
