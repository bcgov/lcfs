import { buttonClusterConfigFn } from '../buttonConfigs'
import { TRANSACTION_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import {
  ADMIN_ADJUSTMENT,
  INITIATIVE_AGREEMENT
} from '@/views/Transactions/constants'
import type { RoleName } from '@/constants/roles'
import { describe, expect, it, vi, beforeEach } from 'vite-plus/test'

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

const iconColor = (button: object) =>
  'iconColor' in button ? button.iconColor : undefined
const disabled = (button: object) =>
  'disabled' in button ? button.disabled : undefined

describe('buttonConfigs', () => {
  describe('Button Configuration Styles', () => {
    it('should create buttons with outlined variant', () => {
      const mockParams = {
        transactionId: 123,
        transactionType: INITIATIVE_AGREEMENT,
        hasRoles: vi.fn(() => true),
        t: vi.fn((key: string) => key),
        setModalData: vi.fn(),
        createUpdateAdminAdjustment: vi.fn(),
        createUpdateInitiativeAgreement: vi.fn(),
        internalComment: 'test'
      } satisfies Parameters<typeof buttonClusterConfigFn>[0]

      const result = buttonClusterConfigFn(mockParams)

      expect(result.New[0].variant).toBe('outlined')
      expect(result.New[0].color).toBe('primary')
    })

    it('should create buttons with contained variant', () => {
      const mockParams = {
        transactionId: 123,
        transactionType: INITIATIVE_AGREEMENT,
        hasRoles: vi.fn(() => true),
        t: vi.fn((key: string) => key),
        setModalData: vi.fn(),
        createUpdateAdminAdjustment: vi.fn(),
        createUpdateInitiativeAgreement: vi.fn(),
        internalComment: 'test'
      } satisfies Parameters<typeof buttonClusterConfigFn>[0]

      const result = buttonClusterConfigFn(mockParams)

      expect(result.New[1].variant).toBe('contained')
      expect(result.New[1].color).toBe('primary')
      expect(iconColor(result.New[1])).toBe('#ffffff')
    })

    it('should create buttons with red outlined variant', () => {
      const mockParams = {
        transactionId: 123,
        transactionType: INITIATIVE_AGREEMENT,
        hasRoles: vi.fn(() => true),
        t: vi.fn((key: string) => key),
        setModalData: vi.fn(),
        createUpdateAdminAdjustment: vi.fn(),
        createUpdateInitiativeAgreement: vi.fn(),
        internalComment: 'test'
      } satisfies Parameters<typeof buttonClusterConfigFn>[0]

      const result = buttonClusterConfigFn(mockParams)

      expect(result.Draft[0].variant).toBe('outlined')
      expect(result.Draft[0].color).toBe('error')
      expect(iconColor(result.Draft[0])).toBe('#ff0000')
      expect(result.Recommended[0].variant).toBe('outlined')
      expect(result.Recommended[0].color).toBe('error')
    })
  })

  describe('buttonClusterConfigFn', () => {
    const mockT = vi.fn((key: string) => key)
    const mockSetModalData = vi.fn()
    const mockCreateUpdateAdminAdjustment = vi.fn()
    const mockCreateUpdateInitiativeAgreement = vi.fn()
    const mockHasRoles = vi.fn((_role: RoleName) => false)
    const baseMockParams: Parameters<typeof buttonClusterConfigFn>[0] = {
      transactionId: 123,
      transactionType: INITIATIVE_AGREEMENT,
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

        expect(disabled(result.New[0])).toBe(true)
        expect(disabled(result.Draft[1])).toBe(true)
      })

      it('should be enabled if user has analyst role', () => {
        mockHasRoles.mockImplementation((role) => role === roles.analyst)

        const result = buttonClusterConfigFn(baseMockParams)

        expect(disabled(result.New[0])).toBe(false)
        expect(disabled(result.Draft[1])).toBe(false)
      })

      it('should call createUpdateAdminAdjustment for ADMIN_ADJUSTMENT transaction type', () => {
        const params: Parameters<typeof buttonClusterConfigFn>[0] = {
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

        expect(disabled(result.Draft[0])).toBe(true)
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
        const params: Parameters<typeof buttonClusterConfigFn>[0] = {
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

        expect(disabled(result.New[1])).toBe(true)
        expect(disabled(result.Draft[2])).toBe(true)
      })

      it('should be disabled if no transactionId', () => {
        const params: Parameters<typeof buttonClusterConfigFn>[0] = {
          ...baseMockParams,
          transactionId: null
        }
        mockHasRoles.mockImplementation((role) => role === roles.analyst)

        const result = buttonClusterConfigFn(params)

        expect(disabled(result.New[1])).toBe(true)
        expect(disabled(result.Draft[2])).toBe(true)
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

        expect(disabled(result.Recommended[1])).toBe(true)
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

        expect(disabled(result.Recommended[2])).toBe(true)
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
        const params: Parameters<typeof buttonClusterConfigFn>[0] = {
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
        const params: Parameters<typeof buttonClusterConfigFn>[0] = {
          ...baseMockParams,
          transactionId: undefined
        }

        const result = buttonClusterConfigFn(params)

        expect(result).toBeDefined()
        expect(disabled(result.New[1])).toBe(true)
      })

      it('should handle missing internalComment gracefully', () => {
        const params: Parameters<typeof buttonClusterConfigFn>[0] = {
          ...baseMockParams,
          internalComment: undefined
        }

        const result = buttonClusterConfigFn(params)

        expect(result).toBeDefined()
      })

      it('should handle falsy hasRoles function', () => {
        const params: Parameters<typeof buttonClusterConfigFn>[0] = {
          ...baseMockParams,
          hasRoles: vi.fn(() => false)
        }

        const result = buttonClusterConfigFn(params)

        expect(result).toBeDefined()
        expect(disabled(result.New[0])).toBe(true)
        expect(disabled(result.New[1])).toBe(true)
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
