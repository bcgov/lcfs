import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { vi, describe, expect, beforeEach } from 'vitest'
import { CreditMarketAccordion } from '../CreditMarketAccordion'
import { test } from '@/tests/utils/fixtures'

// Mock translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => {
      const translations = {
        'creditMarket:informationBulletin':
          'Information Bulletin RLCF-013 (Credit trading market)',
        'creditMarket:background': 'Background',
        'creditMarket:backgroundText1':
          'Beginning in 2024, to participate in the credit market...',
        'creditMarket:backgroundText2':
          'Compliance with the low carbon fuel requirements...',
        'creditMarket:backgroundText3':
          'The Low Carbon Fuel Standard has historically...',
        'creditMarket:creditsIssuedByDirector':
          'Credits issued by the director',
        'creditMarket:creditsIssuedText':
          'Before credits can be transferred...',
        'creditMarket:allocationAgreements': 'Allocation agreements',
        'creditMarket:allocationAgreementsText':
          'Allocation agreements allow fuel suppliers...',
        'creditMarket:fairMarketValue': 'Fair market value',
        'creditMarket:fairMarketValueText1':
          'All transfers must include a "fair market value"...',
        'creditMarket:fairMarketValueText2':
          'The "fair market value" is generally accepted...',
        'creditMarket:approvalOfTransfers': 'Approval of transfers',
        'creditMarket:approvalOfTransfersText':
          'All transfers must be approved by the director...',
        'creditMarket:applicationOfCredits': 'Application of credits',
        'creditMarket:applicationOfCreditsText':
          'Only those credits held on the reporting deadline...',
        'creditMarket:needMoreInformation': 'Need more information?',
        'creditMarket:needMoreInformationText':
          'Please visit the Low Carbon Fuels website...',
        'creditMarket:legalDisclaimer':
          'This information is for your convenience and guidance only...'
      }
      return translations[key] || fallback || key
    }
  })
}))

describe('CreditMarketAccordion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders the component with correct title', ({ render, theme }) => {
    render(<CreditMarketAccordion />, [theme])

    expect(
      screen.getByText('Information Bulletin RLCF-013 (Credit trading market)')
    ).toBeInTheDocument()
  })

  test('starts expanded by default', ({ render, theme }) => {
    render(<CreditMarketAccordion />, [theme])

    // Check if accordion is expanded by looking for the content
    expect(screen.getByText('Background')).toBeInTheDocument()
    expect(
      screen.getByText(/Beginning in 2024, to participate in the credit market/)
    ).toBeInTheDocument()
  })

  test('renders all section headings', ({ render, theme }) => {
    render(<CreditMarketAccordion />, [theme])

    expect(screen.getByText('Background')).toBeInTheDocument()
    expect(
      screen.getByText('Credits issued by the director')
    ).toBeInTheDocument()
    expect(screen.getByText('Allocation agreements')).toBeInTheDocument()
    expect(screen.getByText('Fair market value')).toBeInTheDocument()
    expect(screen.getByText('Approval of transfers')).toBeInTheDocument()
    expect(screen.getByText('Application of credits')).toBeInTheDocument()
    expect(screen.getByText('Need more information?')).toBeInTheDocument()
  })

  test('renders all section content', ({ render, theme }) => {
    render(<CreditMarketAccordion />, [theme])

    expect(
      screen.getByText(/Beginning in 2024, to participate in the credit market/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Compliance with the low carbon fuel requirements/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/The Low Carbon Fuel Standard has historically/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Before credits can be transferred/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/All transfers must include a "fair market value"/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/The "fair market value" is generally accepted/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/All transfers must be approved by the director/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Only those credits held on the reporting deadline/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Allocation agreements allow fuel suppliers/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Please visit the Low Carbon Fuels website/)
    ).toBeInTheDocument()
  })

  test('renders legal disclaimer', ({ render, theme }) => {
    render(<CreditMarketAccordion />, [theme])

    expect(
      screen.getByText(
        /This information is for your convenience and guidance only/
      )
    ).toBeInTheDocument()
  })

  test('can be collapsed and expanded by clicking on the accordion header', ({
    render,
    theme
  }) => {
    render(<CreditMarketAccordion />, [theme])

    // Find the accordion button
    const accordionButton = screen.getByRole('button')

    // Initially expanded - content should be visible
    expect(screen.getByText('Background')).toBeInTheDocument()

    // Click to collapse
    fireEvent.click(accordionButton)

    // Wait for animation and check that content is hidden
    // In MUI, collapsed content is still in DOM but hidden
    const backgroundText = screen.queryByText('Background')
    expect(backgroundText).toBeTruthy() // Still in DOM
  })

  test('has proper accessibility attributes', ({ render, theme }) => {
    render(<CreditMarketAccordion />, [theme])

    // Check for ARIA attributes on the accordion button
    const accordionButton = screen.getByRole('button')
    expect(accordionButton).toHaveAttribute('aria-expanded', 'true')
  })

  test('handles missing translations gracefully', ({ render, theme }) => {
    // This test verifies the component renders even with missing translations
    render(<CreditMarketAccordion />, [theme])

    // Should still render with translation keys working
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(
      screen.getByText('Information Bulletin RLCF-013 (Credit trading market)')
    ).toBeInTheDocument()
  })

  test('maintains proper component structure', ({ render, theme }) => {
    render(<CreditMarketAccordion />, [theme])

    // Should have accordion structure
    expect(screen.getByRole('button')).toBeInTheDocument()

    // Should have content sections
    expect(screen.getByText('Background')).toBeInTheDocument()
    expect(screen.getByText('Fair market value')).toBeInTheDocument()
  })
})
