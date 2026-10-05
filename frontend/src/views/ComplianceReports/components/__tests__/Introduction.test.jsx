import React from 'react'
import { describe, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Introduction } from '../Introduction'
import { test } from '@/tests/utils/fixtures'
import * as reactI18next from 'react-i18next'

// Create a more complete mock for react-i18next
vi.mock('react-i18next', () => {
  const actual = vi.importActual('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key, options) => {
        // Handle the early issuance sections translation
        if (key === 'report:earlyIssuanceIntroSections') {
          return [
            {
              header: 'Early Issuance Section 1',
              content: ['<p>Early issuance content for section 1.</p>']
            },
            {
              header: 'Early Issuance Section 2',
              content: ['<p>Early issuance content for section 2.</p>']
            }
          ]
        }
        // Handle the regular sections translation
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
    }),
    Trans: ({ i18nKey, components }) => {
      // Simple implementation to handle Trans component
      if (i18nKey === 'report:contact') {
        return <p>Contact us at email@example.com</p>
      }
      // For section content
      if (i18nKey.startsWith('<p>')) {
        return <p>{i18nKey.replace(/<\/?p>/g, '')}</p>
      }
      return i18nKey
    }
  }
})

describe('Introduction component', () => {
  test('renders the accordion with introduction header', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<Introduction expanded={true} compliancePeriod={'2024'} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Introduction Header')).toBeInTheDocument()
    expect(screen.getByTestId('compliance-report-intro')).toBeInTheDocument()
  })

  test('renders with expanded=false', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<Introduction expanded={false} compliancePeriod={'2024'} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Introduction Header')).toBeInTheDocument()
    expect(screen.getByTestId('compliance-report-intro')).toBeInTheDocument()
  })

  test('renders regular sections correctly when isEarlyIssuance is not set', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<Introduction expanded={true} compliancePeriod={'2024'} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Section 1')).toBeInTheDocument()
    expect(screen.getByText('Content for section 1.')).toBeInTheDocument()

    expect(screen.getByText('Section 2')).toBeInTheDocument()
    expect(screen.getByText('Content for section 2.')).toBeInTheDocument()
  })

  test('renders early issuance sections when isEarlyIssuance is true', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(
      <Introduction
        expanded={true}
        compliancePeriod={'2024'}
        isEarlyIssuance={true}
      />,
      [query, theme, localization, router]
    )

    expect(screen.getByText('Early Issuance Section 1')).toBeInTheDocument()
    expect(
      screen.getByText('Early issuance content for section 1.')
    ).toBeInTheDocument()

    expect(screen.getByText('Early Issuance Section 2')).toBeInTheDocument()
    expect(
      screen.getByText('Early issuance content for section 2.')
    ).toBeInTheDocument()
  })

  test('renders questions and contact information correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<Introduction expanded={true} compliancePeriod={'2024'} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Questions Header')).toBeInTheDocument()
    expect(
      screen.getByText('Contact us at email@example.com')
    ).toBeInTheDocument()
  })

  // This test verifies that compliance period values are passed correctly
  test('passes compliancePeriod to translations', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    // Temporarily spy on the useTranslation hook
    const tSpy = vi.fn((key, options) => {
      if (key === 'report:sections') {
        return [
          { header: 'Section 1', content: ['<p>Content for section 1.</p>'] }
        ]
      }
      return key
    })

    // Override the mock for this specific test
    const useTranslationSpy = vi.spyOn(reactI18next, 'useTranslation')
    useTranslationSpy.mockReturnValue({
      t: tSpy
    })

    render(<Introduction expanded={true} compliancePeriod={'2024'} />, [
      query,
      theme,
      localization,
      router
    ])

    // Check if t was called with the correct parameters
    expect(tSpy).toHaveBeenCalledWith(
      'report:sections',
      expect.objectContaining({
        returnObjects: true,
        complianceYear: '2024',
        nextYear: 2025
      })
    )

    // Restore the original implementation
    useTranslationSpy.mockRestore()
  })

  test('handles different compliancePeriod formats correctly', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const tSpy = vi.fn((key, options) => {
      if (key === 'report:sections') {
        return [
          { header: 'Section 1', content: ['<p>Content for section 1.</p>'] }
        ]
      }
      return key
    })

    const useTranslationSpy = vi.spyOn(reactI18next, 'useTranslation')
    useTranslationSpy.mockReturnValue({ t: tSpy })

    render(<Introduction expanded={true} compliancePeriod={2023} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(tSpy).toHaveBeenCalledWith(
      'report:sections',
      expect.objectContaining({
        returnObjects: true,
        complianceYear: 2023,
        nextYear: 2024
      })
    )

    useTranslationSpy.mockRestore()
  })

  test('handles empty sections array', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const tSpy = vi.fn((key, options) => {
      if (key === 'report:sections') {
        return []
      }
      if (key === 'report:introduction') return 'Introduction Header'
      if (key === 'report:questions') return 'Questions Header'
      if (key === 'report:contact') return '<p>Contact us</p>'
      return key
    })

    const useTranslationSpy = vi.spyOn(reactI18next, 'useTranslation')
    useTranslationSpy.mockReturnValue({ t: tSpy })

    render(<Introduction expanded={true} compliancePeriod={'2024'} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Introduction Header')).toBeInTheDocument()
    expect(screen.getByText('Questions Header')).toBeInTheDocument()

    useTranslationSpy.mockRestore()
  })

  test('handles section with empty content array', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const tSpy = vi.fn((key, options) => {
      if (key === 'report:sections') {
        return [{ header: 'Empty Section', content: [] }]
      }
      if (key === 'report:introduction') return 'Introduction Header'
      return key
    })

    const useTranslationSpy = vi.spyOn(reactI18next, 'useTranslation')
    useTranslationSpy.mockReturnValue({ t: tSpy })

    render(<Introduction expanded={true} compliancePeriod={'2024'} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Empty Section')).toBeInTheDocument()

    useTranslationSpy.mockRestore()
  })

  test('handles section with multiple content items', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    const tSpy = vi.fn((key, options) => {
      if (key === 'report:sections') {
        return [
          {
            header: 'Multi Content Section',
            content: [
              '<p>First content.</p>',
              '<p>Second content.</p>',
              '<p>Third content.</p>'
            ]
          }
        ]
      }
      if (key === 'report:introduction') return 'Introduction Header'
      return key
    })

    const useTranslationSpy = vi.spyOn(reactI18next, 'useTranslation')
    useTranslationSpy.mockReturnValue({ t: tSpy })

    render(<Introduction expanded={true} compliancePeriod={'2024'} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByText('Multi Content Section')).toBeInTheDocument()
    expect(screen.getByText('First content.')).toBeInTheDocument()
    expect(screen.getByText('Second content.')).toBeInTheDocument()
    expect(screen.getByText('Third content.')).toBeInTheDocument()

    useTranslationSpy.mockRestore()
  })

  test('renders intro-details test id', ({
    render,
    query,
    theme,
    localization,
    router
  }) => {
    render(<Introduction expanded={true} compliancePeriod={'2024'} />, [
      query,
      theme,
      localization,
      router
    ])

    expect(screen.getByTestId('intro-details')).toBeInTheDocument()
  })
})
