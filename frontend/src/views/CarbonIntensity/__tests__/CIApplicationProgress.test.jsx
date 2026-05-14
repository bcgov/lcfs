import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import {
  CI_APPLICATION_STEPS,
  CIApplicationProgress
} from '@/views/CarbonIntensity/components/CIApplicationProgress'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

describe('CIApplicationProgress', () => {
  afterEach(cleanup)

  it('exposes the canonical 5-step list', () => {
    expect(CI_APPLICATION_STEPS).toHaveLength(5)
    expect(CI_APPLICATION_STEPS.map((s) => s.key)).toEqual([
      'step1',
      'step2',
      'step3',
      'step4',
      'step5'
    ])
  })

  it('renders all step labels', () => {
    render(<CIApplicationProgress activeStep={0} />, { wrapper })
    expect(screen.getByText('carbonIntensity:steps.step1')).toBeInTheDocument()
    expect(screen.getByText('carbonIntensity:steps.step2')).toBeInTheDocument()
    expect(screen.getByText('carbonIntensity:steps.step5')).toBeInTheDocument()
  })

  it('marks the active step with Mui-active styling', () => {
    const { container } = render(<CIApplicationProgress activeStep={2} />, {
      wrapper
    })
    const steps = container.querySelectorAll('.MuiStep-root')
    expect(steps).toHaveLength(5)
    // The third step (index 2) should be active
    const activeLabels = steps[2].querySelectorAll('.Mui-active')
    expect(activeLabels.length).toBeGreaterThan(0)
  })
})
