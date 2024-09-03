import React from 'react'
import { render, screen } from '@testing-library/react'
import { CommentList } from '../CommentList'
import { wrapper } from '@/tests/utils/wrapper.jsx'

describe('CommentList', () => {
  const mockComments = [
    { name: 'Alice', comment: 'This is a great post!' },
    { name: 'Bob', comment: 'Thanks for sharing!' }
  ]

  test('renders correctly with comments', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    expect(screen.getByText('Comments')).toBeInTheDocument()
  })

  test('renders the correct number of comment items', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(mockComments.length)
  })

  test('displays the correct names and comments', () => {
    render(<CommentList comments={mockComments} />, { wrapper })
    mockComments.forEach((comment) => {
      expect(screen.getByText(`${comment.name}:`)).toBeInTheDocument()
      expect(screen.getByText(comment.comment)).toBeInTheDocument()
    })
  })
})
