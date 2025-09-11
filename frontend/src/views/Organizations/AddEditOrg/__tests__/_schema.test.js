import { describe, it, expect } from 'vitest'
import { schemaValidation, createValidationSchema } from '../_schema'

describe('Organization Form Schema Validation', () => {
  // Mock organization types data
  const mockOrgTypes = [
    {
      organizationTypeId: 1,
      orgType: 'fuel_supplier',
      description: 'Fuel supplier',
      isBceidUser: true
    },
    {
      organizationTypeId: 2,
      orgType: 'aggregator',
      description: 'Aggregator',
      isBceidUser: true
    },
    {
      organizationTypeId: 3,
      orgType: 'fuel_producer',
      description: 'Fuel producer, fuel code applicant',
      isBceidUser: false
    },
    {
      organizationTypeId: 4,
      orgType: 'exempted_supplier',
      description: 'Exempted supplier',
      isBceidUser: false
    },
    {
      organizationTypeId: 5,
      orgType: 'initiative_agreement_holder',
      description: 'Initiative agreement holder',
      isBceidUser: false
    }
  ]

  // Test legacy static schema
  describe('Legacy Static Schema', () => {
    it('validates correct form data without errors', async () => {
      const validData = {
        orgLegalName: 'Test Company Inc.',
        orgOperatingName: 'Test Co',
        orgEmailAddress: 'test@example.com',
        orgPhoneNumber: '(604) 123-4567',
        orgType: '1',
        orgRegForTransfers: '1',
        orgStreetAddress: '123 Test St',
        orgCity: 'Vancouver',
        orgPostalCodeZipCode: 'V6B3K9',
        hasEarlyIssuance: 'true',
        orgCreditTradingEnabled: 'true'
      }

      await expect(schemaValidation.validate(validData)).resolves.not.toThrow()
    })
  })

  // Test dynamic schema for BCeID organization types
  describe('Dynamic Schema - BCeID Organizations', () => {
    const bceidSchema = createValidationSchema(mockOrgTypes, '1') // Fuel supplier

    it('validates BCeID org with all required fields', async () => {
      const validData = {
        orgLegalName: 'Test Company Inc.',
        orgOperatingName: 'Test Co',
        orgEmailAddress: 'test@example.com',
        orgPhoneNumber: '(604) 123-4567',
        orgType: '1',
        orgRegForTransfers: '1',
        orgStreetAddress: '123 Test St',
        orgCity: 'Vancouver',
        orgPostalCodeZipCode: 'V6B3K9',
        hasEarlyIssuance: 'yes'
      }

      await expect(bceidSchema.validate(validData)).resolves.not.toThrow()
    })

    it('requires phone number for BCeID org types', async () => {
      const invalidData = {
        orgLegalName: 'Test Company Inc.',
        orgOperatingName: 'Test Co',
        orgEmailAddress: 'test@example.com',
        // orgPhoneNumber: '(604) 123-4567', // Missing phone
        orgType: '1',
        orgRegForTransfers: '1',
        orgStreetAddress: '123 Test St',
        orgCity: 'Vancouver',
        orgPostalCodeZipCode: 'V6B3K9',
        hasEarlyIssuance: 'yes'
      }

      await expect(bceidSchema.validate(invalidData)).rejects.toThrow(
        'Phone Number is required.'
      )
    })

    it('requires address fields for BCeID org types', async () => {
      const invalidData = {
        orgLegalName: 'Test Company Inc.',
        orgOperatingName: 'Test Co',
        orgEmailAddress: 'test@example.com',
        orgPhoneNumber: '(604) 123-4567',
        orgType: '1',
        orgRegForTransfers: '1',
        // orgStreetAddress: '123 Test St', // Missing address
        orgCity: 'Vancouver',
        orgPostalCodeZipCode: 'V6B3K9',
        hasEarlyIssuance: 'yes'
      }

      await expect(bceidSchema.validate(invalidData)).rejects.toThrow(
        'Street Address / PO Box is required.'
      )
    })
  })

  // Test dynamic schema for non-BCeID organization types
  describe('Dynamic Schema - Non-BCeID Organizations', () => {
    const nonBceidSchema = createValidationSchema(mockOrgTypes, '3') // Fuel producer

    it('validates non-BCeID org with minimal required fields', async () => {
      const validData = {
        orgLegalName: 'Test Producer Inc.',
        orgOperatingName: 'Test Producer',
        orgEmailAddress: 'producer@example.com',
        orgType: '3',
        orgRegForTransfers: '1',
        hasEarlyIssuance: 'no'
      }

      await expect(nonBceidSchema.validate(validData)).resolves.not.toThrow()
    })

    it('does not require phone number for non-BCeID org types', async () => {
      const validData = {
        orgLegalName: 'Test Producer Inc.',
        orgOperatingName: 'Test Producer',
        orgEmailAddress: 'producer@example.com',
        orgType: '3',
        orgRegForTransfers: '1',
        hasEarlyIssuance: 'no'
        // No phone number provided
      }

      await expect(nonBceidSchema.validate(validData)).resolves.not.toThrow()
    })

    it('does not require address fields for non-BCeID org types', async () => {
      const validData = {
        orgLegalName: 'Test Producer Inc.',
        orgOperatingName: 'Test Producer',
        orgEmailAddress: 'producer@example.com',
        orgType: '3',
        orgRegForTransfers: '1',
        hasEarlyIssuance: 'no'
        // No address fields provided
      }

      await expect(nonBceidSchema.validate(validData)).resolves.not.toThrow()
    })

    it('still requires email for non-BCeID org types', async () => {
      const invalidData = {
        orgLegalName: 'Test Producer Inc.',
        orgOperatingName: 'Test Producer',
        // orgEmailAddress: 'producer@example.com', // Missing email
        orgType: '3',
        orgRegForTransfers: '1',
        hasEarlyIssuance: 'no'
      }

      await expect(nonBceidSchema.validate(invalidData)).rejects.toThrow(
        'Email Address is required.'
      )
    })

    it('validates optional phone number format when provided', async () => {
      const invalidData = {
        orgLegalName: 'Test Producer Inc.',
        orgOperatingName: 'Test Producer',
        orgEmailAddress: 'producer@example.com',
        orgPhoneNumber: 'invalid-phone-format!',
        orgType: '3',
        orgRegForTransfers: '1',
        hasEarlyIssuance: 'no'
      }

      await expect(nonBceidSchema.validate(invalidData)).rejects.toThrow(
        'Invalid format'
      )
    })

    it('validates optional postal code format when provided', async () => {
      const invalidData = {
        orgLegalName: 'Test Producer Inc.',
        orgOperatingName: 'Test Producer',
        orgEmailAddress: 'producer@example.com',
        orgType: '3',
        orgRegForTransfers: '1',
        orgCity: 'Vancouver',
        orgPostalCodeZipCode: 'INVALID-FORMAT',
        hasEarlyIssuance: 'no'
      }

      await expect(nonBceidSchema.validate(invalidData)).rejects.toThrow(
        'Please enter a valid Postal / ZIP Code.'
      )
    })
  })

  // Test cross-org-type validation scenarios
  describe('Validation Scenarios', () => {
    it('validates switching from BCeID to non-BCeID type', async () => {
      const bceidSchema = createValidationSchema(mockOrgTypes, '1')
      const nonBceidSchema = createValidationSchema(mockOrgTypes, '3')

      // Start with BCeID data (all required fields filled)
      const bceidData = {
        orgLegalName: 'Test Company Inc.',
        orgOperatingName: 'Test Co',
        orgEmailAddress: 'test@example.com',
        orgPhoneNumber: '(604) 123-4567',
        orgType: '1',
        orgRegForTransfers: '1',
        orgStreetAddress: '123 Test St',
        orgCity: 'Vancouver',
        orgPostalCodeZipCode: 'V6B3K9',
        hasEarlyIssuance: 'yes'
      }

      await expect(bceidSchema.validate(bceidData)).resolves.not.toThrow()

      // Switch to non-BCeID type - should still pass even with address/phone
      const nonBceidData = { ...bceidData, orgType: '3' }
      await expect(nonBceidSchema.validate(nonBceidData)).resolves.not.toThrow()
    })

    it('validates switching from non-BCeID to BCeID type', async () => {
      const nonBceidSchema = createValidationSchema(mockOrgTypes, '3')
      const bceidSchema = createValidationSchema(mockOrgTypes, '1')

      // Start with minimal non-BCeID data
      const nonBceidData = {
        orgLegalName: 'Test Producer Inc.',
        orgOperatingName: 'Test Producer',
        orgEmailAddress: 'producer@example.com',
        orgType: '3',
        orgRegForTransfers: '1',
        hasEarlyIssuance: 'no'
      }

      await expect(nonBceidSchema.validate(nonBceidData)).resolves.not.toThrow()

      // Switch to BCeID type - should fail due to missing required fields
      const bceidData = { ...nonBceidData, orgType: '1' }
      await expect(bceidSchema.validate(bceidData)).rejects.toThrow()
    })
  })
})
