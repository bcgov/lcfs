import { render, screen, configure } from '@testing-library/react'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ValidationRenderer2 } from '../ValidationRenderer2'

// Override the global testIdAttribute configuration for this test file
beforeAll(() => {
  configure({ testIdAttribute: 'data-testid' })
})

afterAll(() => {
  configure({ testIdAttribute: 'data-test' })
})

describe('ValidationRenderer2', () => {
  it('renders warning icon with tooltip for warning status', () => {
    const data = { validationStatus: 'warning' }
    render(<ValidationRenderer2 data={data} />)
    
    const icon = screen.getByTestId('validation-sign')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('aria-label', 'shows sign for validation')
  })

  it('renders error icon with custom validation message', () => {
    const data = { 
      validationStatus: 'error',
      validationMsg: 'Custom error message'
    }
    render(<ValidationRenderer2 data={data} />)
    
    const icon = screen.getByTestId('validation-sign')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('aria-label', 'shows sign for validation')
  })

  it('renders error icon with default message when validationMsg is empty', () => {
    const data = { 
      validationStatus: 'error',
      validationMsg: ''
    }
    render(<ValidationRenderer2 data={data} />)
    
    const icon = screen.getByTestId('validation-sign')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('aria-label', 'shows sign for validation')
  })

  it('renders error icon with default message when validationMsg is undefined', () => {
    const data = { validationStatus: 'error' }
    render(<ValidationRenderer2 data={data} />)
    
    const icon = screen.getByTestId('validation-sign')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('aria-label', 'shows sign for validation')
  })

  it('renders success icon with tooltip for success status', () => {
    const data = { validationStatus: 'success' }
    render(<ValidationRenderer2 data={data} />)
    
    const icon = screen.getByTestId('validation-sign')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('aria-label', 'shows sign for validation')
  })

  it('renders circular progress for pending status', () => {
    const data = { validationStatus: 'pending' }
    render(<ValidationRenderer2 data={data} />)
    
    const progress = screen.getByRole('progressbar')
    expect(progress).toBeInTheDocument()
  })

  it('renders nothing for unknown validation status', () => {
    const data = { validationStatus: 'unknown' }
    const { container } = render(<ValidationRenderer2 data={data} />)
    
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for undefined validation status', () => {
    const data = { validationStatus: undefined }
    const { container } = render(<ValidationRenderer2 data={data} />)
    
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for null validation status', () => {
    const data = { validationStatus: null }
    const { container } = render(<ValidationRenderer2 data={data} />)
    
    expect(container.firstChild).toBeNull()
  })
})