import { createRef } from 'react'
import type { ElementRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TransportModeDistanceCellEditor } from '../TransportModeDistanceCellEditor'

describe('TransportModeDistanceCellEditor', () => {
  it('returns null for selected modes with blank distance', () => {
    const ref = createRef<ElementRef<typeof TransportModeDistanceCellEditor>>()

    render(
      <TransportModeDistanceCellEditor
        ref={ref}
        value={[]}
        options={['Truck']}
        api={{ stopEditing: vi.fn() }}
      />
    )

    fireEvent.click(screen.getByLabelText('Select Truck'))

    expect(ref.current?.getValue()).toEqual([
      { transportMode: 'Truck', distance: null }
    ])
  })

  it('provides explicit done and cancel controls', () => {
    const stopEditing = vi.fn()

    render(
      <TransportModeDistanceCellEditor
        value={[]}
        options={['Truck']}
        api={{ stopEditing }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(stopEditing).toHaveBeenNthCalledWith(1)
    expect(stopEditing).toHaveBeenNthCalledWith(2, true)
  })
})
