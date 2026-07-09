import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RobotAvatar } from '../RobotAvatar'

describe('RobotAvatar', () => {
  it('renders the Methy robot gif in a square avatar frame', () => {
    const { container } = render(
      <RobotAvatar
        robot={{
          name: 'Methy',
          color: '#003366',
          background: '#fff'
        }}
        size={64}
      />
    )

    const image = container.querySelector('img')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('aria-hidden', 'true')
    expect(image?.getAttribute('src')).toContain('analyst-review-methy')
  })
})
