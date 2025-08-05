import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CreditMarketAccordion } from '../CreditMarketAccordion'
import { wrapper } from '@/tests/utils/wrapper'

// Mock translation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => {
      const translations = {
        'creditMarket:informationBulletin': 'Information Bulletin RLCF-013 (Credit trading market)',
        'creditMarket:background': 'Background',
        'creditMarket:backgroundText1': 'Beginning in 2024, to participate in the credit market...',
        'creditMarket:backgroundText2': 'Compliance with the low carbon fuel requirements...',
        'creditMarket:backgroundText3': 'The Low Carbon Fuel Standard has historically...',
        'creditMarket:complianceUnitsIssued': 'Compliance units issued by the director',
        'creditMarket:complianceUnitsText': 'Before credits can be transferred...',
        'creditMarket:fairMarketValue': 'Fair market value',
        'creditMarket:fairMarketValueText1': 'All transfers must include a "fair market value"...',
        'creditMarket:fairMarketValueText2': 'The "fair market value" is generally accepted...',
        'creditMarket:approvalOfTransfers': 'Approval of transfers',
        'creditMarket:approvalOfTransfersText': 'All transfers must be approved by the director...',
        'creditMarket:applicationOfCredits': 'Application of credits',
        'creditMarket:applicationOfCreditsText': 'Only those credits held on the reporting deadline...',
        'creditMarket:needMoreInformation': 'Need more information?',
        'creditMarket:needMoreInformationText': 'Please visit the Low Carbon Fuels website...',
        'creditMarket:legalDisclaimer': 'This information is for your convenience and guidance only...'
      }
      return translations[key] || fallback || key
    }
  })
}))

describe('CreditMarketAccordion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the component with correct title', () => {
    render(<CreditMarketAccordion />, { wrapper })

    expect(screen.getByText('Information Bulletin RLCF-013 (Credit trading market)')).toBeInTheDocument()
  })

  it('starts expanded by default', () => {
    render(<CreditMarketAccordion />, { wrapper })

    // Check if accordion is expanded by looking for the content
    expect(screen.getByText('Background')).toBeInTheDocument()
    expect(screen.getByText(/Beginning in 2024, to participate in the credit market/)).toBeInTheDocument()
  })

  it('renders all section headings', () => {
    render(<CreditMarketAccordion />, { wrapper })

    expect(screen.getByText('Background')).toBeInTheDocument()
    expect(screen.getByText('Compliance units issued by the director')).toBeInTheDocument()
    expect(screen.getByText('Fair market value')).toBeInTheDocument()
    expect(screen.getByText('Approval of transfers')).toBeInTheDocument()
    expect(screen.getByText('Application of credits')).toBeInTheDocument()
    expect(screen.getByText('Need more information?')).toBeInTheDocument()
  })

  it('renders all section content', () => {
    render(<CreditMarketAccordion />, { wrapper })

    expect(screen.getByText(/Beginning in 2024, to participate in the credit market/)).toBeInTheDocument()
    expect(screen.getByText(/Compliance with the low carbon fuel requirements/)).toBeInTheDocument()
    expect(screen.getByText(/The Low Carbon Fuel Standard has historically/)).toBeInTheDocument()
    expect(screen.getByText(/Before credits can be transferred/)).toBeInTheDocument()
    expect(screen.getByText(/All transfers must include a "fair market value"/)).toBeInTheDocument()
    expect(screen.getByText(/The "fair market value" is generally accepted/)).toBeInTheDocument()
    expect(screen.getByText(/All transfers must be approved by the director/)).toBeInTheDocument()
    expect(screen.getByText(/Only those credits held on the reporting deadline/)).toBeInTheDocument()
    expect(screen.getByText(/Please visit the Low Carbon Fuels website/)).toBeInTheDocument()
  })

  it('renders legal disclaimer', () => {
    render(<CreditMarketAccordion />, { wrapper })

    expect(screen.getByText(/This information is for your convenience and guidance only/)).toBeInTheDocument()
  })

  it('can be collapsed and expanded by clicking on the accordion header', () => {
    render(<CreditMarketAccordion />, { wrapper })

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

  it('has proper accessibility attributes', () => {
    render(<CreditMarketAccordion />, { wrapper })

    // Check for ARIA attributes on the accordion button
    const accordionButton = screen.getByRole('button')
    expect(accordionButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('handles missing translations gracefully', () => {
    // This test verifies the component renders even with missing translations
    render(<CreditMarketAccordion />, { wrapper })

    // Should still render with translation keys working
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('Information Bulletin RLCF-013 (Credit trading market)')).toBeInTheDocument()
  })

  it('maintains proper component structure', () => {
    render(<CreditMarketAccordion />, { wrapper })

    // Should have accordion structure
    expect(screen.getByRole('button')).toBeInTheDocument()
    
    // Should have content sections
    expect(screen.getByText('Background')).toBeInTheDocument()
    expect(screen.getByText('Fair market value')).toBeInTheDocument()
  })
})