import React from 'react'
import { describe, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import BCWidgetCard from '../BCWidgetCard'
import { WidgetEditButton } from '../WidgetEditButton'
import { test } from '@/tests/utils/fixtures'

describe('WidgetEditButton', () => {
  test('renders the standard header edit button', ({ render, app }) => {
    render(
      <WidgetEditButton data-test="edit">Edit details</WidgetEditButton>,
      app
    )

    const button = screen.getByRole('button', { name: 'Edit details' })
    expect(button).toHaveClass('MuiButton-outlined', 'MuiButton-sizeSmall')
    expect(button).toHaveStyle({ maxHeight: '25px', minHeight: '25px' })
    expect(button.querySelector('[data-testid="EditIcon"]')).toBeInTheDocument()
  })

  test('forwards clicks and attributes', ({ render, app }) => {
    const onClick = vi.fn()
    render(
      <WidgetEditButton data-test="edit" onClick={onClick}>
        Edit details
      </WidgetEditButton>,
      app
    )

    fireEvent.click(screen.getByTestId('edit'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('is the same button BCWidgetCard draws for its built-in editButton', ({
    render,
    app
  }) => {
    render(
      <BCWidgetCard
        title="Card"
        editButton={{ text: 'Edit details', onClick: () => {} }}
        content={<p>Body</p>}
      />,
      app
    )

    const button = screen.getByRole('button', { name: 'Edit details' })
    expect(button).toHaveClass('MuiButton-outlined', 'MuiButton-sizeSmall')
    expect(button).toHaveStyle({ maxHeight: '25px', minHeight: '25px' })
    expect(button.querySelector('[data-testid="EditIcon"]')).toBeInTheDocument()
  })
})
