import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { YesNoTextRenderer } from '../grid/cellRenderers'
import { wrapper } from '@/tests/utils/wrapper'

describe('YesNoTextRenderer', () => {
  it('renders "Yes" when value is true', () => {
    const props = {
      value: true
    }

    render(<YesNoTextRenderer {...props} />, { wrapper })

    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('renders "No" when value is false', () => {
    const props = {
      value: false
    }

    render(<YesNoTextRenderer {...props} />, { wrapper })

    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders "No" when value is undefined', () => {
    const props = {
      value: undefined
    }

    render(<YesNoTextRenderer {...props} />, { wrapper })

    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders "No" when value is null', () => {
    const props = {
      value: null
    }

    render(<YesNoTextRenderer {...props} />, { wrapper })

    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders "Yes" when value is truthy', () => {
    const props = {
      value: 1
    }

    render(<YesNoTextRenderer {...props} />, { wrapper })

    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('renders "No" when value is falsy', () => {
    const props = {
      value: 0
    }

    render(<YesNoTextRenderer {...props} />, { wrapper })

    expect(screen.getByText('No')).toBeInTheDocument()
  })
})
