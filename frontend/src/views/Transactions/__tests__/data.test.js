import { describe, it, expect } from 'vitest'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '../constants'

// The legacy data.js file contained only commented-out fixture data and no
// runtime exports.  These tests cover the sibling constants module, which
// provides the transaction-type string literals consumed throughout the
// Transactions views.

describe('Transactions constants', () => {
  describe('ADMIN_ADJUSTMENT', () => {
    it('equals the expected string', () => {
      expect(ADMIN_ADJUSTMENT).toBe('administrativeAdjustment')
    })

    it('is a non-empty string', () => {
      expect(typeof ADMIN_ADJUSTMENT).toBe('string')
      expect(ADMIN_ADJUSTMENT.length).toBeGreaterThan(0)
    })

    it('does not contain whitespace', () => {
      expect(ADMIN_ADJUSTMENT).not.toMatch(/\s/)
    })
  })

  describe('INITIATIVE_AGREEMENT', () => {
    it('equals the expected string', () => {
      expect(INITIATIVE_AGREEMENT).toBe('initiativeAgreement')
    })

    it('is a non-empty string', () => {
      expect(typeof INITIATIVE_AGREEMENT).toBe('string')
      expect(INITIATIVE_AGREEMENT.length).toBeGreaterThan(0)
    })

    it('does not contain whitespace', () => {
      expect(INITIATIVE_AGREEMENT).not.toMatch(/\s/)
    })
  })

  it('ADMIN_ADJUSTMENT and INITIATIVE_AGREEMENT are distinct values', () => {
    expect(ADMIN_ADJUSTMENT).not.toBe(INITIATIVE_AGREEMENT)
  })
})
