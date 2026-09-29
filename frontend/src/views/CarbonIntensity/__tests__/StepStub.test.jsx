import React from 'react'
import { afterEach, describe, expect, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

import { StepStub } from '@/views/CarbonIntensity/components/StepStub'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}))

describe('StepStub', () => {
  afterEach(cleanup)

  test('renders the title key and the coming-soon alert', ({
    render,
    theme
  }) => {
    render(<StepStub titleKey="carbonIntensity:steps.step2" />, [theme])
    expect(screen.getByText('carbonIntensity:steps.step2')).toBeInTheDocument()
    expect(
      screen.getByText('carbonIntensity:stepStub.comingSoon')
    ).toBeInTheDocument()
  })
})
