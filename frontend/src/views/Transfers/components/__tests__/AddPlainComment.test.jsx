import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AddPlainComment } from '../AddPlainComment'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/hooks/useCurrentUser')

describe('AddPlainComment Component', () => {
  let mockHandleCommentChange

  beforeEach(() => {
    mockHandleCommentChange = vi.fn()
  })

  describe('Rendering based on props', () => {
    it('renders for government user with transferStatus "Submitted"', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Submitted"
          isGovernmentUser={true}
        />,
        { wrapper }
      )

      expect(
        screen.getByText('Government comments to organizations (optional)')
      ).toBeInTheDocument()
    })

    it('renders for government user with transferStatus "Recommended"', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Recommended"
          isGovernmentUser={true}
        />,
        { wrapper }
      )

      expect(
        screen.getByText('Government comments to organizations (optional)')
      ).toBeInTheDocument()
    })

    it('does not render for government user with invalid transferStatus', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Draft"
          isGovernmentUser={true}
        />,
        { wrapper }
      )

      expect(
        screen.queryByText('Government comments to organizations (optional)')
      ).not.toBeInTheDocument()
    })

    it('renders for non-government user when sameOrganization returns true and transferStatus is "Sent"', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        { wrapper }
      )

      expect(
        screen.getByText('Your comments (optional)')
      ).toBeInTheDocument()
    })

    it('does not render for non-government user when transferStatus is not "Sent"', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Draft"
          isGovernmentUser={false}
        />,
        { wrapper }
      )

      expect(
        screen.queryByText('Comments to government (optional)')
      ).not.toBeInTheDocument()
    })

    it('does not render for non-government user when sameOrganization returns false', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        { wrapper }
      )

      expect(
        screen.queryByText('Comments to government (optional)')
      ).not.toBeInTheDocument()
    })

    it('uses government label when both isGovernmentUser and sameOrganization return true', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Submitted"
          isGovernmentUser={true}
        />,
        { wrapper }
      )

      expect(
        screen.getByText('Government comments to organizations (optional)')
      ).toBeInTheDocument()
      expect(
        screen.queryByText('Comments to government (optional)')
      ).not.toBeInTheDocument()
    })
  })

  describe('Functionality', () => {
    it('toggles the comment input visibility when clicking the toggle button', async () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        { wrapper }
      )

      // Initially, the comment input should not be visible
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

      const toggleButton = screen.getByTestId('toggle-comments')

      // Click to expand
      fireEvent.click(toggleButton)
      expect(screen.getByRole('textbox')).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      })
    })

    it('displays initial comment value correctly', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      const initialComment = 'Initial comment'
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment={initialComment}
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        { wrapper }
      )

      // Expand the comment input
      fireEvent.click(screen.getByTestId('toggle-comments'))

      expect(screen.getByRole('textbox')).toHaveValue(initialComment)
    })

    it('calls handleCommentChange with correct value', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        { wrapper }
      )
    
      fireEvent.click(screen.getByTestId('toggle-comments'))
    
      const newComment = 'New comment'
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: newComment }
      })
    
      expect(mockHandleCommentChange).toHaveBeenCalledWith(newComment)
    })

    it('shows correct toggle icon based on isExpanded state', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        { wrapper }
      )
    
      const toggleButton = screen.getByTestId('toggle-comments')
    
      // Initially, the comment input should not be visible
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    
      // The expand icon should be present
      expect(toggleButton.querySelector('svg[data-testid="ExpandMoreIcon"]')).toBeInTheDocument()
    
      // Click to expand
      fireEvent.click(toggleButton)
    
      // The collapse icon should be present
      expect(toggleButton.querySelector('svg[data-testid="ExpandLessIcon"]')).toBeInTheDocument()
    
      // The comment input should now be visible
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })    

    it('calls sameOrganization with toOrgId', () => {
      const mockSameOrganization = vi.fn(() => true)
      useCurrentUser.mockReturnValue({ sameOrganization: mockSameOrganization })
      const toOrgId = 1
      render(
        <AddPlainComment
          toOrgId={toOrgId}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        { wrapper }
      )

      expect(mockSameOrganization).toHaveBeenCalledWith(toOrgId)
    })

    it('should handle default isGovernmentUser prop when not provided', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment="test"
          transferStatus="Sent"
        />,
        { wrapper }
      )

      expect(screen.getByText('Your comments (optional)')).toBeInTheDocument()
    })

    it('should render input field with correct properties when expanded', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment="test comment"
          transferStatus="Sent"
        />,
        { wrapper }
      )

      fireEvent.click(screen.getByTestId('toggle-comments'))
      
      const textField = screen.getByRole('textbox')
      expect(textField).toHaveAttribute('rows', '4')
      expect(textField).toHaveValue('test comment')
    })

    it('should handle empty comment string', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
        />,
        { wrapper }
      )

      fireEvent.click(screen.getByTestId('toggle-comments'))
      
      const textField = screen.getByRole('textbox')
      expect(textField).toHaveValue('')
    })

    it('should handle click on toggle box area', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
        />,
        { wrapper }
      )

      // Initially collapsed
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      
      // Click anywhere on the toggle area (not just the button)
      const toggleBox = screen.getByTestId('toggle-comments').closest('div')
      fireEvent.click(toggleBox)
      
      // Should expand
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should use different toOrgId values correctly', () => {
      const mockSameOrganization = vi.fn(() => false)
      useCurrentUser.mockReturnValue({ sameOrganization: mockSameOrganization })
      
      const { rerender } = render(
        <AddPlainComment
          toOrgId={999}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
        />,
        { wrapper }
      )

      expect(mockSameOrganization).toHaveBeenCalledWith(999)
      
      mockSameOrganization.mockReturnValue(true)
      rerender(
        <AddPlainComment
          toOrgId={123}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
        />
      )
      
      expect(mockSameOrganization).toHaveBeenCalledWith(123)
    })

    it('should handle multiple status values for government user', () => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
      
      // Test with additional valid statuses
      const { rerender } = render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Submitted"
          isGovernmentUser={true}
        />,
        { wrapper }
      )
      
      expect(screen.getByText('Government comments to organizations (optional)')).toBeInTheDocument()
      
      rerender(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Recommended"
          isGovernmentUser={true}
        />
      )
      
      expect(screen.getByText('Government comments to organizations (optional)')).toBeInTheDocument()
    })
  })
})
