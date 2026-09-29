import { buttonClusterConfigFn } from '../buttonConfigs'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import { ADMIN_ADJUSTMENT } from '@/views/Transactions/constants'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/themes/base/colors', () => ({
  default: {
    white: { main: '#ffffff' },
    error: { main: '#ff0000' }
  }
}))

vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faFloppyDisk: 'faFloppyDisk',
  faTrash: 'faTrash'
}))

describe('buttonConfigs', () => {
  describe('Button Configuration Styles', () => {
    it('should create buttons with outlined variant', () => {
      const mockParams = {
        transactionId: 123,
        transactionType: 'initiativeAgreement',
        methods: { getValues: vi.fn() },
        hasRoles: vi.fn(() => true),
        t: vi.fn((key) => key),
        setModalData: vi.fn(),
        createUpdateAdminAdjustment: vi.fn(),
        createUpdateInitiativeAgreement: vi.fn(),
        internalComment: 'test'
      }
      
      const result = buttonClusterConfigFn(mockParams)
      
      expect(result.New[0].variant).toBe('outlined')
      expect(result.New[0].color).toBe('primary')
    })

    it('should create buttons with contained variant', () => {
      const mockParams = {
        transactionId: 123,
        transactionType: 'initiativeAgreement',
        methods: { getValues: vi.fn() },
        hasRoles: vi.fn(() => true),
        t: vi.fn((key) => key),
        setModalData: vi.fn(),
        createUpdateAdminAdjustment: vi.fn(),
        createUpdateInitiativeAgreement: vi.fn(),
        internalComment: 'test'
      }
      
      const result = buttonClusterConfigFn(mockParams)
      
      expect(result.New[1].variant).toBe('contained')
      expect(result.New[1].color).toBe('primary')
      expect(result.New[1].iconColor).toBe('#ffffff')
    })

    it('should create buttons with red outlined variant', () => {
      const mockParams = {
        transactionId: 123,
        transactionType: 'initiativeAgreement',
        methods: { getValues: vi.fn() },
        hasRoles: vi.fn(() => true),
        t: vi.fn((key) => key),
        setModalData: vi.fn(),
        createUpdateAdminAdjustment: vi.fn(),
        createUpdateInitiativeAgreement: vi.fn(),
        internalComment: 'test'
      }
      
      const result = buttonClusterConfigFn(mockParams)
      
      expect(result.Draft[0].variant).toBe('outlined')
      expect(result.Draft[0].color).toBe('error')
      expect(result.Draft[0].iconColor).toBe('#ff0000')
      expect(result.Recommended[0].variant).toBe('outlined')
      expect(result.Recommended[0].color).toBe('error')
    })
  })

  describe('buttonClusterConfigFn', () => {
    const mockT = vi.fn((key) => key)
    const mockSetModalData = vi.fn()
    const mockCreateUpdateAdminAdjustment = vi.fn()
    const mockCreateUpdateInitiativeAgreement = vi.fn()
    const mockHasRoles = vi.fn()
    const mockMethods = { getValues: vi.fn() }
    
    const baseMockParams = {
      transactionId: 123,
      transactionType: 'initiativeAgreement',
      methods: mockMethods,
      hasRoles: mockHasRoles,
      t: mockT,
      setModalData: mockSetModalData,
      createUpdateAdminAdjustment: mockCreateUpdateAdminAdjustment,
      createUpdateInitiativeAgreement: mockCreateUpdateInitiativeAgreement,
      internalComment: 'test comment'
    }

    beforeEach(() => {
      vi.clearAllMocks()
      mockHasRoles.mockReturnValue(true)
    })

    describe('Button Structure', () => {
      it('should return correct button structure', () => {
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result).toEqual({
          New: expect.arrayContaining([
            expect.objectContaining({ id: 'save-draft-btn' }),
            expect.objectContaining({ id: 'recommend-btn' })
          ]),
          Draft: expect.arrayContaining([
            expect.objectContaining({ id: 'delete-draft-btn' }),
            expect.objectContaining({ id: 'save-draft-btn' }),
            expect.objectContaining({ id: 'recommend-btn' })
          ]),
          Recommended: expect.arrayContaining([
            expect.objectContaining({ id: 'delete-btn' }),
            expect.objectContaining({ id: 'return-to-analyst-btn' }),
            expect.objectContaining({ id: 'approve-btn' })
          ]),
          Approved: [],
          Deleted: []
        })
      })
    })

    describe('saveDraft Button', () => {
      it('should be disabled if user lacks analyst role', () => {
        mockHasRoles.mockImplementation((role) => role !== roles.analyst)
        
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result.New[0].disabled).toBe(true)
        expect(result.Draft[1].disabled).toBe(true)
      })

      it('should be enabled if user has analyst role', () => {
        mockHasRoles.mockImplementation((role) => role === roles.analyst)
        
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result.New[0].disabled).toBe(false)
        expect(result.Draft[1].disabled).toBe(false)
      })

      it('should call createUpdateAdminAdjustment for ADMIN_ADJUSTMENT transaction type', () => {
        const params = { 
          ...baseMockParams, 
          transactionType: ADMIN_ADJUSTMENT 
        }
        mockHasRoles.mockImplementation((role) => role === roles.analyst)
        
        const result = buttonClusterConfigFn(params)
        const formData = { test: 'data' }
        
        result.New[0].handler(formData)
        
        expect(mockCreateUpdateAdminAdjustment).toHaveBeenCalledWith({
          data: {
            test: 'data',
            internalComment: 'test comment',
            currentStatus: TRANSACTION_STATUSES.DRAFT
          }
        })
      })

      it('should call createUpdateInitiativeAgreement for other transaction types', () => {
        mockHasRoles.mockImplementation((role) => role === roles.analyst)
        
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        result.New[0].handler(formData)
        
        expect(mockCreateUpdateInitiativeAgreement).toHaveBeenCalledWith({
          data: {
            test: 'data',
            internalComment: 'test comment',
            currentStatus: TRANSACTION_STATUSES.DRAFT
          }
        })
      })
    })

    describe('deleteDraft Button', () => {
      it('should be disabled if user lacks analyst role', () => {
        mockHasRoles.mockImplementation((role) => role !== roles.analyst)
        
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result.Draft[0].disabled).toBe(true)
      })

      it('should setup modal with correct config', () => {
        mockHasRoles.mockImplementation((role) => role === roles.analyst)
        
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        result.Draft[0].handler(formData)
        
        expect(mockSetModalData).toHaveBeenCalledWith({
          primaryButtonAction: expect.any(Function),
          primaryButtonText: 'txn:actionBtns.deleteDraftBtn',
          primaryButtonColor: 'error',
          secondaryButtonText: 'cancelBtn',
          title: 'confirmation',
          content: 'initiativeAgreement:deleteDraftConfirmText'
        })
      })

      it('should execute primaryButtonAction with ADMIN_ADJUSTMENT', async () => {
        const params = { 
          ...baseMockParams, 
          transactionType: ADMIN_ADJUSTMENT 
        }
        mockHasRoles.mockImplementation((role) => role === roles.analyst)
        
        const result = buttonClusterConfigFn(params)
        const formData = { test: 'data' }
        
        await result.Draft[0].handler(formData)
        
        const modalCall = mockSetModalData.mock.calls[0][0]
        await modalCall.primaryButtonAction()
        
        expect(mockCreateUpdateAdminAdjustment).toHaveBeenCalledWith({
          data: {
            test: 'data',
            currentStatus: TRANSACTION_STATUSES.DELETED
          }
        })
      })
    })

    describe('recommendTransaction Button', () => {
      it('should be disabled if user lacks analyst role', () => {
        mockHasRoles.mockImplementation((role) => role !== roles.analyst)
        
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result.New[1].disabled).toBe(true)
        expect(result.Draft[2].disabled).toBe(true)
      })

      it('should be disabled if no transactionId', () => {
        const params = { ...baseMockParams, transactionId: null }
        mockHasRoles.mockImplementation((role) => role === roles.analyst)
        
        const result = buttonClusterConfigFn(params)
        
        expect(result.New[1].disabled).toBe(true)
        expect(result.Draft[2].disabled).toBe(true)
      })

      it('should setup modal with correct config', async () => {
        mockHasRoles.mockImplementation((role) => role === roles.analyst)
        
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        await result.New[1].handler(formData)
        
        expect(mockSetModalData).toHaveBeenCalledWith({
          primaryButtonAction: expect.any(Function),
          primaryButtonText: 'txn:actionBtns.recommendBtn',
          primaryButtonColor: 'primary',
          secondaryButtonText: 'cancelBtn',
          title: 'confirmation',
          content: 'initiativeAgreement:recommendConfirmText'
        })
      })

      it('should execute primaryButtonAction correctly', async () => {
        mockHasRoles.mockImplementation((role) => role === roles.analyst)
        
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        await result.New[1].handler(formData)
        
        const modalCall = mockSetModalData.mock.calls[0][0]
        await modalCall.primaryButtonAction()
        
        expect(mockCreateUpdateInitiativeAgreement).toHaveBeenCalledWith({
          data: {
            test: 'data',
            internalComment: 'test comment',
            currentStatus: TRANSACTION_STATUSES.RECOMMENDED
          }
        })
      })
    })

    describe('returnTransaction Button', () => {
      it('should be disabled if user lacks director role', () => {
        mockHasRoles.mockImplementation((role) => role !== roles.director)
        
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result.Recommended[1].disabled).toBe(true)
      })

      it('should setup modal with warning text', async () => {
        mockHasRoles.mockImplementation((role) => role === roles.director)
        
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        await result.Recommended[1].handler(formData)
        
        expect(mockSetModalData).toHaveBeenCalledWith({
          primaryButtonAction: expect.any(Function),
          primaryButtonText: 'txn:actionBtns.returnToAnalystBtn',
          primaryButtonColor: 'primary',
          secondaryButtonText: 'cancelBtn',
          title: 'confirmation',
          content: 'txn:returnConfirmText',
          warningText: 'txn:returnWarningText'
        })
      })

      it('should execute primaryButtonAction correctly', async () => {
        mockHasRoles.mockImplementation((role) => role === roles.director)
        
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        await result.Recommended[1].handler(formData)
        
        const modalCall = mockSetModalData.mock.calls[0][0]
        await modalCall.primaryButtonAction()
        
        expect(mockCreateUpdateInitiativeAgreement).toHaveBeenCalledWith({
          data: {
            test: 'data',
            currentStatus: TRANSACTION_STATUSES.DRAFT
          }
        })
      })
    })

    describe('approveTransaction Button', () => {
      it('should be disabled if user lacks director role', () => {
        mockHasRoles.mockImplementation((role) => role !== roles.director)
        
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result.Recommended[2].disabled).toBe(true)
      })

      it('should setup modal with correct config', async () => {
        mockHasRoles.mockImplementation((role) => role === roles.director)
        
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        await result.Recommended[2].handler(formData)
        
        expect(mockSetModalData).toHaveBeenCalledWith({
          primaryButtonAction: expect.any(Function),
          primaryButtonText: 'txn:actionBtns.approveBtn',
          primaryButtonColor: 'primary',
          secondaryButtonText: 'cancelBtn',
          title: 'confirmation',
          content: 'initiativeAgreement:approveConfirmText'
        })
      })

      it('should execute primaryButtonAction correctly', async () => {
        mockHasRoles.mockImplementation((role) => role === roles.director)
        
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        await result.Recommended[2].handler(formData)
        
        const modalCall = mockSetModalData.mock.calls[0][0]
        await modalCall.primaryButtonAction()
        
        expect(mockCreateUpdateInitiativeAgreement).toHaveBeenCalledWith({
          data: {
            test: 'data',
            currentStatus: TRANSACTION_STATUSES.APPROVED
          }
        })
      })
    })

    describe('deleteTransaction Button', () => {
      it('should setup modal with correct config', async () => {
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        await result.Recommended[0].handler(formData)
        
        expect(mockSetModalData).toHaveBeenCalledWith({
          primaryButtonAction: expect.any(Function),
          primaryButtonText: 'txn:actionBtns.deleteBtn',
          primaryButtonColor: 'error',
          secondaryButtonText: 'cancelBtn',
          title: 'confirmation',
          content: 'initiativeAgreement:deleteConfirmText'
        })
      })

      it('should execute primaryButtonAction with ADMIN_ADJUSTMENT', async () => {
        const params = { 
          ...baseMockParams, 
          transactionType: ADMIN_ADJUSTMENT 
        }
        
        const result = buttonClusterConfigFn(params)
        const formData = { test: 'data' }
        
        await result.Recommended[0].handler(formData)
        
        const modalCall = mockSetModalData.mock.calls[0][0]
        await modalCall.primaryButtonAction()
        
        expect(mockCreateUpdateAdminAdjustment).toHaveBeenCalledWith({
          data: {
            test: 'data',
            currentStatus: TRANSACTION_STATUSES.DELETED
          }
        })
      })

      it('should execute primaryButtonAction with other transaction types', async () => {
        const result = buttonClusterConfigFn(baseMockParams)
        const formData = { test: 'data' }
        
        await result.Recommended[0].handler(formData)
        
        const modalCall = mockSetModalData.mock.calls[0][0]
        await modalCall.primaryButtonAction()
        
        expect(mockCreateUpdateInitiativeAgreement).toHaveBeenCalledWith({
          data: {
            test: 'data',
            currentStatus: TRANSACTION_STATUSES.DELETED
          }
        })
      })
    })

    describe('Status Arrays', () => {
      it('should return empty arrays for Approved status', () => {
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result.Approved).toEqual([])
      })

      it('should return empty arrays for Deleted status', () => {
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result.Deleted).toEqual([])
      })
    })

    describe('Edge Cases', () => {
      it('should handle missing transactionId gracefully', () => {
        const params = { ...baseMockParams, transactionId: undefined }
        
        const result = buttonClusterConfigFn(params)
        
        expect(result).toBeDefined()
        expect(result.New[1].disabled).toBe(true)
      })

      it('should handle missing internalComment gracefully', () => {
        const params = { ...baseMockParams, internalComment: undefined }
        
        const result = buttonClusterConfigFn(params)
        
        expect(result).toBeDefined()
      })

      it('should handle falsy hasRoles function', () => {
        const params = { ...baseMockParams, hasRoles: vi.fn(() => false) }
        
        const result = buttonClusterConfigFn(params)
        
        expect(result).toBeDefined()
        expect(result.New[0].disabled).toBe(true)
        expect(result.New[1].disabled).toBe(true)
      })
    })

    describe('Button Labels and Icons', () => {
      it('should have correct labels and icons for all buttons', () => {
        const result = buttonClusterConfigFn(baseMockParams)
        
        expect(result.New[0].startIcon).toBe('faFloppyDisk')
        expect(result.Draft[0].startIcon).toBe('faTrash')
        expect(result.Recommended[0].startIcon).toBe('faTrash')
        
        expect(mockT).toHaveBeenCalledWith('txn:actionBtns.saveDraftBtn')
        expect(mockT).toHaveBeenCalledWith('txn:actionBtns.deleteDraftBtn')
        expect(mockT).toHaveBeenCalledWith('txn:actionBtns.recommendBtn')
        expect(mockT).toHaveBeenCalledWith('txn:actionBtns.returnToAnalystBtn')
        expect(mockT).toHaveBeenCalledWith('txn:actionBtns.approveBtn')
        expect(mockT).toHaveBeenCalledWith('txn:actionBtns.deleteBtn')
      })
    })
  })
})