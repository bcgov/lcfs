import React from 'react'
import { describe, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { initiativeAgreementColDefs } from '../_schema'
import { test } from '@/tests/utils/fixtures'

vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useInitiativeAgreementStatuses: () => ({ data: [], isLoading: false })
}))

const t = (key) => key

const lastCommentColumn = () =>
  initiativeAgreementColDefs(t).find((col) => col.field === 'lastComment')

describe('last comment column', () => {
  test('renders the commenter initials and the comment as a tooltip', ({
    render,
    app
  }) => {
    const Renderer = lastCommentColumn().cellRenderer
    render(
      <Renderer
        data={{
          lastComment: { fullName: 'Kenneth Chan', comment: 'plain words' }
        }}
      />,
      app
    )
    expect(screen.getByText('KC')).toBeInTheDocument()
  })

  test('renders nothing when the agreement has no visible comment', ({
    render,
    app
  }) => {
    const Renderer = lastCommentColumn().cellRenderer
    const { container } = render(<Renderer data={{ lastComment: null }} />, app)
    expect(container.textContent).toBe('')
  })

  test('is not sortable or filterable', () => {
    const col = lastCommentColumn()
    expect(col.sortable).toBe(false)
    expect(col.filter).toBe(false)
  })
})
