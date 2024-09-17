import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AddPlainComment } from '../AddPlainComment'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { describe, expect, it, vi } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('@/hooks/useCurrentUser')

describe('AddPlainComment', () => {
  const mockHandleCommentChange = vi.fn()

  it('renders correctly for government user with valid transfer status', () => {
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

  it('does not render when conditions are not met', () => {
    useCurrentUser.mockReturnValue({ sameOrganization: vi.fn(() => false) })
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
      screen.queryByText('Government comments to organizations (optional)')
    ).not.toBeInTheDocument()
  })

  it('toggles the comment input visibility', async () => {
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

    expect(screen.getByTestId('comment-input')).not.toBeVisible()

    const toggleButton = screen.getByTestId('toggle-comments')

    // Click to expand
    fireEvent.click(toggleButton)
    expect(screen.getByTestId('comment-input')).toBeVisible()

    // Click to collapse
    fireEvent.click(toggleButton)
    await waitFor(() => {
      expect(screen.getByTestId('comment-input')).not.toBeVisible()
    })
  })

  it('calls handleCommentChange on comment change', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /expand comments/i }))
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'New comment' }
    })

    expect(mockHandleCommentChange).toHaveBeenCalled()
  })
})
