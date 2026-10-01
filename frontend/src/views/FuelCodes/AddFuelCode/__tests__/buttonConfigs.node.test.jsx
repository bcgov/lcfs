import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fuelCodeButtonConfigFn,
  buildFuelCodeButtonContext
} from '../buttonConfigs.jsx'

// Mock FontAwesome icons
vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faFloppyDisk: 'faFloppyDisk',
  faPencil: 'faPencil',
  faTrash: 'faTrash',
  faCheck: 'faCheck',
  faThumbsUp: 'faThumbsUp',
  faUndo: 'faUndo'
}))

// Mock constants
vi.mock('@/constants/statuses', () => ({
  FUEL_CODE_STATUSES: {
    DRAFT: 'DRAFT',
    RECOMMENDED: 'RECOMMENDED',
    APPROVED: 'APPROVED'
  }
}))

vi.mock('@/constants/roles', () => ({
  roles: {
    director: 'director',
    analyst: 'analyst'
  }
}))

describe('buttonConfigs', () => {
  let mockContext

  beforeEach(() => {
    vi.clearAllMocks()
    mockContext = {
      hasRoles: vi.fn(),
      t: vi.fn((key) => `translated:${key}`),
      setModalData: vi.fn(),
      handleSave: vi.fn(),
      handleRecommend: vi.fn(),
      handleApprove: vi.fn(),
      handleEdit: vi.fn(),
      handleDelete: vi.fn(),
      handleReturnToAnalyst: vi.fn(),
      hasValidationErrors: false,
      hasChanges: true,
      isComplete: true,
      canDelete: true,
      shouldShowSaveButton: true,
      shouldShowEditButton: true,
      currentStatus: 'DRAFT'
    }
  })

  // Test getUserType indirectly through fuelCodeButtonConfigFn
  describe('getUserType behavior (through fuelCodeButtonConfigFn)', () => {
    it('should identify director role correctly', () => {
      mockContext.hasRoles.mockImplementation((role) => role === 'director')
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = true

      const result = fuelCodeButtonConfigFn(mockContext)
      
      // Director in DRAFT status should have save, edit, approve buttons (per FUEL_CODE_BUTTON_RULES)
      expect(result.DRAFT).toBeDefined()
      expect(result.DRAFT.length).toBeGreaterThan(0)
    })

    it('should identify analyst role correctly', () => {
      mockContext.hasRoles.mockImplementation((role) => role === 'analyst')
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = true
      mockContext.shouldShowEditButton = true
      mockContext.canDelete = true
      mockContext.status = 'DRAFT'

      const result = fuelCodeButtonConfigFn(mockContext)
      
      // Analyst in DRAFT status should have edit, save, recommendToDirector, delete buttons
      expect(result.DRAFT).toBeDefined()
      expect(result.DRAFT.length).toBeGreaterThan(2)
    })

    it('should handle unknown user type by returning empty array', () => {
      mockContext.hasRoles.mockImplementation(() => false)
      mockContext.currentStatus = 'DRAFT'

      const result = fuelCodeButtonConfigFn(mockContext)
      
      expect(result).toEqual({
        DRAFT: []
      })
    })
  })

  // Test button factory methods indirectly through fuelCodeButtonConfigFn
  describe('Button creation and configuration', () => {
    beforeEach(() => {
      mockContext.hasRoles.mockImplementation((role) => role === 'analyst')
    })

    it('should create save button with correct properties', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = true
      mockContext.shouldShowEditButton = false
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const saveButton = result.DRAFT.find(btn => btn.id === 'save-fuel-code-btn')
      
      expect(saveButton).toBeDefined()
      expect(saveButton).toMatchObject({
        variant: 'outlined',
        color: 'primary',
        id: 'save-fuel-code-btn',
        label: 'translated:fuelCode:actionBtns.saveFuelCodeBtn',
        startIcon: 'faFloppyDisk'
      })
    })

    it('should create recommend button with correct properties', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.hasValidationErrors = false
      mockContext.isComplete = true
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const recommendButton = result.DRAFT.find(btn => btn.id === 'recommend-fuel-code-btn')
      
      expect(recommendButton).toBeDefined()
      expect(recommendButton).toMatchObject({
        variant: 'contained',
        color: 'primary',
        id: 'recommend-fuel-code-btn',
        label: 'translated:fuelCode:actionBtns.recommendToDirectorBtn',
        startIcon: 'faThumbsUp'
      })
    })

    it('should create edit button with correct properties', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = true
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const editButton = result.DRAFT.find(btn => btn.id === 'edit-fuel-code-btn')
      
      expect(editButton).toBeDefined()
      expect(editButton).toMatchObject({
        variant: 'outlined',
        color: 'primary',
        id: 'edit-fuel-code-btn',
        label: 'translated:fuelCode:actionBtns.editFuelCodeBtn',
        startIcon: 'faPencil'
      })
    })

    it('should create delete button with correct properties', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.canDelete = true
      mockContext.status = 'DRAFT'

      const result = fuelCodeButtonConfigFn(mockContext)
      const deleteButton = result.DRAFT.find(btn => btn.id === 'delete-fuel-code-btn')
      
      expect(deleteButton).toBeDefined()
      expect(deleteButton).toMatchObject({
        variant: 'outlined',
        color: 'error',
        id: 'delete-fuel-code-btn',
        label: 'translated:fuelCode:actionBtns.deleteFuelCodeBtn',
        startIcon: 'faTrash'
      })
    })
  })

  // Test director-specific buttons
  describe('Director-specific button functionality', () => {
    beforeEach(() => {
      mockContext.hasRoles.mockImplementation((role) => role === 'director')
    })

    it('should create approve button for directors', () => {
      mockContext.currentStatus = 'RECOMMENDED'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.hasValidationErrors = false
      mockContext.isComplete = true

      const result = fuelCodeButtonConfigFn(mockContext)
      const approveButton = result.RECOMMENDED.find(btn => btn.id === 'approve-fuel-code-btn')
      
      expect(approveButton).toBeDefined()
      expect(approveButton).toMatchObject({
        variant: 'contained',
        color: 'primary',
        id: 'approve-fuel-code-btn',
        label: 'translated:fuelCode:actionBtns.approveFuelCodeBtn',
        startIcon: 'faCheck'
      })
    })

    it('should create return to analyst button for directors', () => {
      mockContext.currentStatus = 'RECOMMENDED'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const returnButton = result.RECOMMENDED.find(btn => btn.id === 'return-to-analyst-btn')
      
      expect(returnButton).toBeDefined()
      expect(returnButton).toMatchObject({
        variant: 'outlined',
        color: 'primary',
        id: 'return-to-analyst-btn',
        label: 'translated:fuelCode:actionBtns.returnToAnalystBtn',
        startIcon: 'faUndo'
      })
    })
  })

  // Test shouldShowButton logic indirectly through button visibility
  describe('Button visibility logic', () => {
    beforeEach(() => {
      mockContext.hasRoles.mockImplementation((role) => role === 'analyst')
    })

    it('should hide save button when shouldShowSaveButton is false', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const saveButton = result.DRAFT.find(btn => btn.id === 'save-fuel-code-btn')
      
      expect(saveButton).toBeUndefined()
    })

    it('should hide edit button when shouldShowEditButton is false', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const editButton = result.DRAFT.find(btn => btn.id === 'edit-fuel-code-btn')
      
      expect(editButton).toBeUndefined()
    })

    it('should hide recommend button when validation errors exist', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.hasValidationErrors = true
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const recommendButton = result.DRAFT.find(btn => btn.id === 'recommend-fuel-code-btn')
      
      expect(recommendButton).toBeUndefined()
    })

    it('should hide recommend button when not complete', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.isComplete = false
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const recommendButton = result.DRAFT.find(btn => btn.id === 'recommend-fuel-code-btn')
      
      expect(recommendButton).toBeUndefined()
    })

    it('should hide delete button when canDelete is false', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const deleteButton = result.DRAFT.find(btn => btn.id === 'delete-fuel-code-btn')
      
      expect(deleteButton).toBeUndefined()
    })

    it('should show return to analyst only for RECOMMENDED status', () => {
      mockContext.hasRoles.mockImplementation((role) => role === 'director')
      mockContext.currentStatus = 'RECOMMENDED'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const returnButton = result.RECOMMENDED.find(btn => btn.id === 'return-to-analyst-btn')
      
      expect(returnButton).toBeDefined()
    })

    it('should hide return to analyst for non-RECOMMENDED status', () => {
      mockContext.hasRoles.mockImplementation((role) => role === 'director')
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const returnButton = result.DRAFT.find(btn => btn.id === 'return-to-analyst-btn')
      
      expect(returnButton).toBeUndefined()
    })
  })

  // Test button handler functionality
  describe('Button handler functionality', () => {
    beforeEach(() => {
      mockContext.hasRoles.mockImplementation((role) => role === 'analyst')
    })

    it('should call handleSave when save button is clicked', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = true
      mockContext.shouldShowEditButton = false
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const saveButton = result.DRAFT.find(btn => btn.id === 'save-fuel-code-btn')
      
      saveButton.handler()
      expect(mockContext.handleSave).toHaveBeenCalled()
    })

    it('should call handleRecommend when recommend button is clicked', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.hasValidationErrors = false
      mockContext.isComplete = true
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const recommendButton = result.DRAFT.find(btn => btn.id === 'recommend-fuel-code-btn')
      
      recommendButton.handler()
      expect(mockContext.handleRecommend).toHaveBeenCalled()
    })

    it('should handle edit button click for DRAFT status', () => {
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = true
      mockContext.canDelete = false

      const result = fuelCodeButtonConfigFn(mockContext)
      const editButton = result.DRAFT.find(btn => btn.id === 'edit-fuel-code-btn')
      
      editButton.handler()
      expect(mockContext.handleEdit).toHaveBeenCalled()
      expect(mockContext.setModalData).not.toHaveBeenCalled()
    })

    it('should show modal for edit on non-DRAFT status', () => {
      mockContext.hasRoles.mockImplementation((role) => role === 'director')
      mockContext.currentStatus = 'APPROVED'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = true

      const result = fuelCodeButtonConfigFn(mockContext)
      const editButton = result.APPROVED.find(btn => btn.id === 'edit-fuel-code-btn')
      
      editButton.handler()
      expect(mockContext.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'translated:fuelCode:actionBtns.editFuelCodeBtn',
        secondaryButtonText: 'translated:cancelBtn',
        title: 'translated:fuelCode:editFuelCode',
        content: 'translated:fuelCode:editConfirmText'
      })
    })

    it('should show modal when approve button is clicked', () => {
      mockContext.hasRoles.mockImplementation((role) => role === 'director')
      mockContext.currentStatus = 'RECOMMENDED'
      mockContext.shouldShowSaveButton = false
      mockContext.shouldShowEditButton = false
      mockContext.hasValidationErrors = false
      mockContext.isComplete = true

      const result = fuelCodeButtonConfigFn(mockContext)
      const approveButton = result.RECOMMENDED.find(btn => btn.id === 'approve-fuel-code-btn')
      
      approveButton.handler()
      expect(mockContext.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'translated:fuelCode:actionBtns.approveFuelCodeBtn',
        secondaryButtonText: 'translated:cancelBtn',
        title: 'translated:fuelCode:approveFuelCode',
        content: 'translated:fuelCode:approveConfirmText'
      })
    })
  })

  describe('fuelCodeButtonConfigFn', () => {
    it('should return empty buttons array for unknown user type', () => {
      mockContext.hasRoles.mockImplementation(() => false)
      mockContext.currentStatus = 'DRAFT'

      const result = fuelCodeButtonConfigFn(mockContext)
      
      expect(result).toEqual({
        DRAFT: []
      })
    })

    it('should return buttons for analyst with DRAFT status', () => {
      mockContext.hasRoles.mockImplementation((role) => role === 'analyst')
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowEditButton = true
      mockContext.shouldShowSaveButton = true
      mockContext.hasValidationErrors = false
      mockContext.isComplete = true
      mockContext.canDelete = true
      mockContext.status = 'DRAFT'

      const result = fuelCodeButtonConfigFn(mockContext)
      
      expect(result.DRAFT).toHaveLength(4) // edit, save, recommendToDirector, delete
    })

    it('should return buttons for director with RECOMMENDED status', () => {
      mockContext.hasRoles.mockImplementation((role) => role === 'director')
      mockContext.currentStatus = 'RECOMMENDED'
      mockContext.shouldShowSaveButton = true
      mockContext.shouldShowEditButton = true
      mockContext.hasValidationErrors = false
      mockContext.isComplete = true

      const result = fuelCodeButtonConfigFn(mockContext)
      
      expect(result.RECOMMENDED).toHaveLength(4) // save, edit, approve, returnToAnalyst
    })

    it('should filter out buttons that should not be shown', () => {
      mockContext.hasRoles.mockImplementation((role) => role === 'analyst')
      mockContext.currentStatus = 'DRAFT'
      mockContext.shouldShowSaveButton = false // Hide save button
      mockContext.shouldShowEditButton = true
      mockContext.hasValidationErrors = true // Hide recommend button
      mockContext.canDelete = true
      mockContext.status = 'DRAFT'

      const result = fuelCodeButtonConfigFn(mockContext)
      
      // Should only have edit and delete buttons (save and recommend filtered out)
      expect(result.DRAFT).toHaveLength(2)
    })
  })

  describe('buildFuelCodeButtonContext', () => {
    it('should build context object with all required properties', () => {
      const fuelCode = {
        fuelCodeStatus: { status: 'DRAFT' }
      }
      const hasRoles = vi.fn()
      const t = vi.fn()
      const setModalData = vi.fn()
      const handleSave = vi.fn()
      const handleRecommend = vi.fn()
      const handleApprove = vi.fn()
      const handleEdit = vi.fn()
      const handleDelete = vi.fn()
      const handleReturnToAnalyst = vi.fn()

      const result = buildFuelCodeButtonContext({
        fuelCode,
        hasRoles,
        t,
        setModalData,
        handleSave,
        handleRecommend,
        handleApprove,
        handleEdit,
        handleDelete,
        handleReturnToAnalyst,
        hasChanges: true,
        hasValidationErrors: false,
        isComplete: true,
        canEdit: true,
        canDelete: true,
        shouldShowEditButton: true,
        shouldShowSaveButton: true,
        isInEditMode: false,
        isUpdating: false,
        isButtonOperationInProgress: false,
        currentButtonOperation: null
      })

      expect(result).toMatchObject({
        currentStatus: 'DRAFT',
        hasRoles,
        t,
        setModalData,
        handleSave,
        handleRecommend,
        handleApprove,
        handleEdit,
        handleDelete,
        handleReturnToAnalyst,
        hasChanges: true,
        hasValidationErrors: false,
        isComplete: true,
        canEdit: true,
        canDelete: true,
        shouldShowEditButton: true,
        shouldShowSaveButton: true,
        isInEditMode: false,
        isUpdating: false,
        isButtonOperationInProgress: false,
        currentButtonOperation: null,
        status: 'DRAFT'
      })
    })

    it('should default to DRAFT status when fuelCode status is missing', () => {
      const result = buildFuelCodeButtonContext({
        fuelCode: null,
        hasRoles: vi.fn(),
        t: vi.fn(),
        setModalData: vi.fn(),
        handleSave: vi.fn(),
        handleRecommend: vi.fn(),
        handleApprove: vi.fn(),
        handleEdit: vi.fn(),
        handleDelete: vi.fn(),
        handleReturnToAnalyst: vi.fn()
      })

      expect(result.currentStatus).toBe('DRAFT')
      expect(result.status).toBeUndefined()
    })
  })
})