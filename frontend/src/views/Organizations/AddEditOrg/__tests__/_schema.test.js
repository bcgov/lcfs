import { describe, it, expect } from 'vitest'
import { schemaValidation } from '../_schema'

describe('Organization Form Schema Validation', () => {
  // Test valid data passes validation
  it('validates correct form data without errors', async () => {
    const validData = {
      orgLegalName: 'Test Company Inc.',
      orgOperatingName: 'Test Co',
      orgEmailAddress: 'test@example.com',
      orgPhoneNumber: '(604) 123-4567',
      orgSupplierType: '1',
      orgRegForTransfers: '1',
      orgStreetAddress: '123 Test St',
      orgCity: 'Vancouver',
      orgPostalCodeZipCode: 'V6B3K9',
      hasEarlyIssuance: 'true'
    }

    await expect(schemaValidation.validate(validData)).resolves.not.toThrow()
  })

  // Test required fields
  it('requires orgLegalName field', async () => {
    const invalidData = {
      orgOperatingName: 'Test Co',
      orgEmailAddress: 'test@example.com',
      orgPhoneNumber: '(604) 123-4567',
      orgSupplierType: '1',
      orgRegForTransfers: '1',
      orgStreetAddress: '123 Test St',
      orgCity: 'Vancouver',
      orgPostalCodeZipCode: 'V6B3K9',
      hasEarlyIssuance: 'true'
    }

    await expect(schemaValidation.validate(invalidData))
      .rejects.toThrow('Legal Name of Organization is required.')
  })

  // Test email format
  it('validates email format', async () => {
    const invalidData = {
      orgLegalName: 'Test Company Inc.',
      orgOperatingName: 'Test Co',
      orgEmailAddress: 'not-an-email',
      orgPhoneNumber: '(604) 123-4567',
      orgSupplierType: '1',
      orgRegForTransfers: '1',
      orgStreetAddress: '123 Test St',
      orgCity: 'Vancouver',
      orgPostalCodeZipCode: 'V6B3K9',
      hasEarlyIssuance: 'true'
    }

    await expect(schemaValidation.validate(invalidData))
      .rejects.toThrow('Please enter a valid Email Address.')
  })

  // Test phone number format
  it('validates phone number format', async () => {
    const invalidData = {
      orgLegalName: 'Test Company Inc.',
      orgOperatingName: 'Test Co',
      orgEmailAddress: 'test@example.com',
      orgPhoneNumber: 'not a phone number!',
      orgSupplierType: '1',
      orgRegForTransfers: '1',
      orgStreetAddress: '123 Test St',
      orgCity: 'Vancouver',
      orgPostalCodeZipCode: 'V6B3K9',
      hasEarlyIssuance: 'true'
    }

    await expect(schemaValidation.validate(invalidData))
      .rejects.toThrow('Invalid format')
  })

  // Test postal code format
  it('validates postal code format', async () => {
    const invalidData = {
      orgLegalName: 'Test Company Inc.',
      orgOperatingName: 'Test Co',
      orgEmailAddress: 'test@example.com',
      orgPhoneNumber: '(604) 123-4567',
      orgSupplierType: '1',
      orgRegForTransfers: '1',
      orgStreetAddress: '123 Test St',
      orgCity: 'Vancouver',
      orgPostalCodeZipCode: 'INVALID',
      hasEarlyIssuance: 'true'
    }

    await expect(schemaValidation.validate(invalidData))
      .rejects.toThrow('Please enter a valid Postal / ZIP Code.')
  })

  // Test valid postal codes
  it('accepts valid postal/zip code formats', async () => {
    // Valid Canadian postal code
    await expect(schemaValidation.validate({
      ...validFormData,
      orgPostalCodeZipCode: 'V6B3K9'
    })).resolves.not.toThrow()

    // Valid Canadian postal code with space
    await expect(schemaValidation.validate({
      ...validFormData,
      orgPostalCodeZipCode: 'V6B 3K9'
    })).resolves.not.toThrow()

    // Valid US zip code
    await expect(schemaValidation.validate({
      ...validFormData,
      orgPostalCodeZipCode: '12345'
    })).resolves.not.toThrow()

    // Valid US zip+4
    await expect(schemaValidation.validate({
      ...validFormData,
      orgPostalCodeZipCode: '12345-6789'
    })).resolves.not.toThrow()
  })

  // Test head office fields are optional
  it('allows head office fields to be null or undefined', async () => {
    const validData = {
      orgLegalName: 'Test Company Inc.',
      orgOperatingName: 'Test Co',
      orgEmailAddress: 'test@example.com',
      orgPhoneNumber: '(604) 123-4567',
      orgSupplierType: '1',
      orgRegForTransfers: '1',
      orgStreetAddress: '123 Test St',
      orgCity: 'Vancouver',
      orgPostalCodeZipCode: 'V6B3K9',
      hasEarlyIssuance: 'true',
      orgHeadOfficeStreetAddress: null,
      orgHeadOfficeCity: undefined,
      orgHeadOfficeProvince: null,
      orgHeadOfficeCountry: null,
      orgHeadOfficePostalCodeZipCode: null
    }

    await expect(schemaValidation.validate(validData)).resolves.not.toThrow()
  })
})

// Define a valid form data object for reuse in tests
const validFormData = {
  orgLegalName: 'Test Company Inc.',
  orgOperatingName: 'Test Co',
  orgEmailAddress: 'test@example.com',
  orgPhoneNumber: '(604) 123-4567',
  orgSupplierType: '1',
  orgRegForTransfers: '1',
  orgStreetAddress: '123 Test St',
  orgCity: 'Vancouver',
  orgPostalCodeZipCode: 'V6B3K9',
  hasEarlyIssuance: 'true',
  orgCreditTradingEnabled: 'true'
}
