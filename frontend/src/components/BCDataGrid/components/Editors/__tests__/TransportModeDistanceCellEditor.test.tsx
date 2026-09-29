import { createRef } from 'react'
import type { ElementRef } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import { test } from '@/tests/utils/fixtures'

import { TransportModeDistanceCellEditor } from '../TransportModeDistanceCellEditor'

describe('TransportModeDistanceCellEditor', () => {
  test('returns null for selected modes with blank distance', ({
    render,
    i18n
  }) => {
    const ref = createRef<ElementRef<typeof TransportModeDistanceCellEditor>>()

    render(
      <TransportModeDistanceCellEditor
        ref={ref}
        value={[]}
        options={['Truck']}
        api={{ stopEditing: vi.fn() }}
      />,
      [i18n]
    )

    fireEvent.click(screen.getByLabelText('Select Truck'))

    expect(ref.current?.getValue()).toEqual([
      { transportMode: 'Truck', distance: null }
    ])
  })
})
