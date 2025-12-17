import { describe, it, expect, vi } from 'vitest'
import { equipmentButtonConfigFn, buildButtonContext } from '../../components/buttonConfig'

describe('buttonConfig', () => {
  const mockT = (key) => key
  
  const createMockContext = (overrides = {}) => ({
    t: mockT,
    setModalData: vi.fn(),
    equipmentList: [],
    selectedRows: [],
    isUpdating: false,
    canValidate: false,
    canUndoValidation: false,
    canReturnToDraft: false,
    canSubmit: false,
    canSetToDecommission: false,
    chargingSiteStatus: 'Draft',
    organizationId: 1,
    currentUser: { userId: 1 },
    isGovernmentUser: false,
    hasAnyRole: vi.fn(() => false),
    hasRoles: vi.fn(() => false),
    handleToggleSelectByStatus: vi.fn(),
    handleBulkStatusUpdate: vi.fn(),
    handleClearFilters: vi.fn(),
    ...overrides
  })

  describe('buildButtonContext', () => {
    it('builds context with government user detection', () => {
      const hasAnyRole = vi.fn(() => true)
      const context = buildButtonContext({
        t: mockT,
        hasAnyRole,
        hasRoles: vi.fn(),
        setModalData: vi.fn(),
        equipmentList: [],
        selectedRows: [],
        isUpdating: false,
        canValidate: false,
        canUndoValidation: false,
        canReturnToDraft: false,
        canSubmit: false,
        canSetToDecommission: false,
        chargingSiteStatus: 'Draft',
        organizationId: 1,
        currentUser: { userId: 1 },
        handleToggleSelectByStatus: vi.fn(),
        handleBulkStatusUpdate: vi.fn(),
        handleClearFilters: vi.fn()
      })

      expect(context.isGovernmentUser).toBe(true)
    })
  })

  describe('equipmentButtonConfigFn', () => {
    it('returns buttons for BCeID user', () => {
      const context = createMockContext({
        hasRoles: vi.fn((role) => role === 'supplier')
      })
      
      const buttons = equipmentButtonConfigFn(context)
      expect(buttons).toBeInstanceOf(Array)
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('returns buttons for BCeID manager', () => {
      const context = createMockContext({
        hasRoles: vi.fn((role) => role === 'compliance_reporting')
      })
      
      const buttons = equipmentButtonConfigFn(context)
      expect(buttons).toBeInstanceOf(Array)
      expect(buttons.some(btn => btn.id === 'select-all-draft-btn')).toBe(true)
    })

    it('returns buttons for IDIR analyst', () => {
      const context = createMockContext({
        isGovernmentUser: true,
        hasAnyRole: vi.fn(() => true),
        hasRoles: vi.fn((role) => role === 'analyst')
      })
      
      const buttons = equipmentButtonConfigFn(context)
      expect(buttons).toBeInstanceOf(Array)
      expect(buttons.some(btn => btn.id === 'clear-filters-btn')).toBe(true)
    })

    it('includes clear filters button for all users', () => {
      const context = createMockContext()
      const buttons = equipmentButtonConfigFn(context)
      
      expect(buttons.some(btn => btn.id === 'clear-filters-btn')).toBe(true)
    })

    it('handles empty equipment list', () => {
      const context = createMockContext({ equipmentList: [] })
      const buttons = equipmentButtonConfigFn(context)
      
      expect(buttons).toBeInstanceOf(Array)
    })

    it('creates buttons with proper structure', () => {
      const context = createMockContext()
      const buttons = equipmentButtonConfigFn(context)
      
      buttons.forEach(button => {
        expect(button).toHaveProperty('id')
        expect(button).toHaveProperty('label')
        expect(button).toHaveProperty('handler')
        expect(button).toHaveProperty('variant')
        expect(button).toHaveProperty('color')
      })
    })
  })
})
