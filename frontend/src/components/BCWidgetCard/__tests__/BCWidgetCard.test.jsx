import React from 'react'
import { describe, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import BCWidgetCard from '../BCWidgetCard'
import { test } from '@/tests/utils/fixtures'

describe('BCWidgetCard', () => {
  test('renders the title and content', ({ render, app }) => {
    render(<BCWidgetCard title="My card" content={<p>Body</p>} />, app)

    expect(screen.getByRole('heading', { name: 'My card' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  test('renders no header action by default', ({ render, app }) => {
    render(<BCWidgetCard title="My card" content={<p>Body</p>} />, app)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('renders headerAction inside the blue header, beside the title', ({
    render,
    app
  }) => {
    render(
      <BCWidgetCard
        title="My card"
        headerAction={<button type="button">Edit details</button>}
        content={<p>Body</p>}
      />,
      app
    )

    const header = screen.getByRole('heading', {
      name: 'My card'
    }).parentElement
    expect(header).toContainElement(
      screen.getByRole('button', { name: 'Edit details' })
    )
    expect(screen.getByText('Body').parentElement).not.toContainElement(
      screen.getByRole('button', { name: 'Edit details' })
    )
  })

  test('still supports the built-in editButton alongside headerAction', ({
    render,
    app
  }) => {
    const onClick = vi.fn()
    render(
      <BCWidgetCard
        title="My card"
        editButton={{ text: 'Edit', onClick }}
        headerAction={<button type="button">Extra</button>}
        content={<p>Body</p>}
      />,
      app
    )

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument()
  })
})
