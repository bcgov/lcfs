import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { StepStub } from '@/views/CarbonIntensity/components/StepStub'
import { wrapper } from '@/tests/utils/wrapper'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

describe('StepStub', () => {
  afterEach(cleanup)

  it('renders the title key, the coming-soon alert, and the description', () => {
    render(<StepStub titleKey="carbonIntensity:steps.step2" />, { wrapper })
    expect(screen.getByText('carbonIntensity:steps.step2')).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:stepStub.comingSoon')
    ).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:stepStub.description')
    ).toBeInTheDocument()
  })
})
