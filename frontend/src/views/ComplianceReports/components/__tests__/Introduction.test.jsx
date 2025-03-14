import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Introduction } from '../Introduction'
import { wrapper } from '@/tests/utils/wrapper.jsx'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      if (key === 'report:sections') {
        return [
          { header: 'Section 1', content: ['<p>Content for section 1.</p>'] },
          { header: 'Section 2', content: ['<p>Content for section 2.</p>'] }
        ]
      }
      if (key === 'report:introduction') return 'Introduction Header'
      if (key === 'report:questions') return 'Questions Header'
      if (key === 'report:contact')
        return '<p>Contact us at email@example.com</p>'
      return key
    }
  })
}))

describe('Introduction component', () => {
  it('renders the accordion with introduction header', () => {
    render(<Introduction expanded={true} compliancePeriod={'2024'} />, {
      wrapper
    })

    expect(screen.getByText('Introduction Header')).toBeInTheDocument()
    expect(screen.getByTestId('compliance-report-intro')).toBeInTheDocument()
  })

  it('renders provided sections correctly', () => {
    render(<Introduction expanded={true} compliancePeriod={'2024'} />, {
      wrapper
    })

    expect(screen.getByText('Section 1')).toBeInTheDocument()
    expect(screen.getByText('Content for section 1.')).toBeInTheDocument()

    expect(screen.getByText('Section 2')).toBeInTheDocument()
    expect(screen.getByText('Content for section 2.')).toBeInTheDocument()
  })

  it('renders questions and contact information correctly', () => {
    render(<Introduction expanded={true} compliancePeriod={'2024'} />, {
      wrapper
    })

    expect(screen.getByText('Questions Header')).toBeInTheDocument()
    expect(
      screen.getByText('Contact us at email@example.com')
    ).toBeInTheDocument()
  })
})
