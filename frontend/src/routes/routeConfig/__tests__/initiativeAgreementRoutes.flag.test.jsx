import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CONFIG, FEATURE_FLAGS, isFeatureEnabled } from '@/constants/config'
import withFeatureFlag from '@/utils/withFeatureFlag'

const Page = () => <div data-test="ia-page" />

describe('initiative agreements feature flag', () => {
  beforeEach(() => {
    CONFIG.feature_flags.initiativeAgreements = true
  })
  afterEach(() => {
    CONFIG.feature_flags.initiativeAgreements = true
    cleanup()
  })

  it('exposes the flag under a stable key', () => {
    expect(FEATURE_FLAGS.INITIATIVE_AGREEMENTS).toBe('initiativeAgreements')
  })

  it('renders the page when enabled', () => {
    const Gated = withFeatureFlag(Page, FEATURE_FLAGS.INITIATIVE_AGREEMENTS, '/')
    render(
      <MemoryRouter>
        <Gated />
      </MemoryRouter>
    )
    expect(screen.getByTestId('ia-page')).toBeInTheDocument()
  })

  it('redirects away when disabled', () => {
    CONFIG.feature_flags.initiativeAgreements = false
    expect(isFeatureEnabled(FEATURE_FLAGS.INITIATIVE_AGREEMENTS)).toBe(false)

    const Gated = withFeatureFlag(Page, FEATURE_FLAGS.INITIATIVE_AGREEMENTS, '/')
    render(
      <MemoryRouter>
        <Gated />
      </MemoryRouter>
    )
    expect(screen.queryByTestId('ia-page')).not.toBeInTheDocument()
  })
})
