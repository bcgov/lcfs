import { fireEvent, screen, waitFor } from '@testing-library/react'
import { AddPlainComment } from '../AddPlainComment'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { describe, expect, vi, beforeEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'

vi.mock('@/hooks/useCurrentUser')

describe('AddPlainComment Component', () => {
  let mockHandleCommentChange

  beforeEach(() => {
    mockHandleCommentChange = vi.fn()
  })

  describe('Rendering based on props', () => {
    test('renders for government user with transferStatus "Submitted"', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Submitted"
          isGovernmentUser={true}
        />,
        [theme, i18n]
      )

      expect(
        screen.getByText('Government comments to organizations (optional)')
      ).toBeInTheDocument()
    })

    test('renders for government user with transferStatus "Recommended"', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Recommended"
          isGovernmentUser={true}
        />,
        [theme, i18n]
      )

      expect(
        screen.getByText('Government comments to organizations (optional)')
      ).toBeInTheDocument()
    })

    test('does not render for government user with invalid transferStatus', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Draft"
          isGovernmentUser={true}
        />,
        [theme, i18n]
      )

      expect(
        screen.queryByText('Government comments to organizations (optional)')
      ).not.toBeInTheDocument()
    })

    test('renders for non-government user when sameOrganization returns true and transferStatus is "Sent"', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        [theme, i18n]
      )

      expect(screen.getByText('Your comments (optional)')).toBeInTheDocument()
    })

    test('does not render for non-government user when transferStatus is not "Sent"', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Draft"
          isGovernmentUser={false}
        />,
        [theme, i18n]
      )

      expect(
        screen.queryByText('Comments to government (optional)')
      ).not.toBeInTheDocument()
    })

    test('does not render for non-government user when sameOrganization returns false', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        [theme, i18n]
      )

      expect(
        screen.queryByText('Comments to government (optional)')
      ).not.toBeInTheDocument()
    })

    test('uses government label when both isGovernmentUser and sameOrganization return true', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Submitted"
          isGovernmentUser={true}
        />,
        [theme, i18n]
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
    test('toggles the comment input visibility when clicking the toggle button', async ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        [theme, i18n]
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

    test('displays initial comment value correctly', ({
      render,
      theme,
      i18n
    }) => {
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
        [theme, i18n]
      )

      // Expand the comment input
      fireEvent.click(screen.getByTestId('toggle-comments'))

      expect(screen.getByRole('textbox')).toHaveValue(initialComment)
    })

    test('calls handleCommentChange with correct value', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        [theme, i18n]
      )

      fireEvent.click(screen.getByTestId('toggle-comments'))

      const newComment = 'New comment'
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: newComment }
      })

      expect(mockHandleCommentChange).toHaveBeenCalledWith(newComment)
    })

    test('shows correct toggle icon based on isExpanded state', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
          isGovernmentUser={false}
        />,
        [theme, i18n]
      )

      const toggleButton = screen.getByTestId('toggle-comments')

      // Initially, the comment input should not be visible
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

      // The expand icon should be present
      expect(
        toggleButton.querySelector('svg[data-testid="ExpandMoreIcon"]')
      ).toBeInTheDocument()

      // Click to expand
      fireEvent.click(toggleButton)

      // The collapse icon should be present
      expect(
        toggleButton.querySelector('svg[data-testid="ExpandLessIcon"]')
      ).toBeInTheDocument()

      // The comment input should now be visible
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    test('calls sameOrganization with toOrgId', ({ render, theme, i18n }) => {
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
        [theme, i18n]
      )

      expect(mockSameOrganization).toHaveBeenCalledWith(toOrgId)
    })

    test('should handle default isGovernmentUser prop when not provided', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment="test"
          transferStatus="Sent"
        />,
        [theme, i18n]
      )

      expect(screen.getByText('Your comments (optional)')).toBeInTheDocument()
    })

    test('should render input field with correct properties when expanded', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment="test comment"
          transferStatus="Sent"
        />,
        [theme, i18n]
      )

      fireEvent.click(screen.getByTestId('toggle-comments'))

      const textField = screen.getByRole('textbox')
      expect(textField).toHaveAttribute('rows', '4')
      expect(textField).toHaveValue('test comment')
    })

    test('should handle empty comment string', ({ render, theme, i18n }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
        />,
        [theme, i18n]
      )

      fireEvent.click(screen.getByTestId('toggle-comments'))

      const textField = screen.getByRole('textbox')
      expect(textField).toHaveValue('')
    })

    test('should handle click on toggle box area', ({
      render,
      theme,
      i18n
    }) => {
      useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => true) })
      render(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
        />,
        [theme, i18n]
      )

      // Initially collapsed
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

      // Click anywhere on the toggle area (not just the button)
      const toggleBox = screen.getByTestId('toggle-comments').closest('div')
      fireEvent.click(toggleBox)

      // Should expand
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    test('should use different toOrgId values correctly', ({
      render,
      theme,
      i18n
    }) => {
      const mockSameOrganization = vi.fn(() => false)
      useCurrentUser.mockReturnValue({ sameOrganization: mockSameOrganization })

      const { rerender } = render(
        <AddPlainComment
          toOrgId={999}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Sent"
        />,
        [theme, i18n]
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

    test('should handle multiple status values for government user', ({
      render,
      theme,
      i18n
    }) => {
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
        [theme, i18n]
      )

      expect(
        screen.getByText('Government comments to organizations (optional)')
      ).toBeInTheDocument()

      rerender(
        <AddPlainComment
          toOrgId={1}
          handleCommentChange={mockHandleCommentChange}
          comment=""
          transferStatus="Recommended"
          isGovernmentUser={true}
        />
      )

      expect(
        screen.getByText('Government comments to organizations (optional)')
      ).toBeInTheDocument()
    })
  })
})
