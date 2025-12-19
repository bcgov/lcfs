import { 
  redOutlinedButton, 
  outlinedButton, 
  containedButton, 
  buttonClusterConfigFn 
} from '../buttonConfigs'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/themes/base/colors', () => ({
  default: {
    white: { main: '#ffffff' },
    error: { main: '#error' }
  }
}))

vi.mock('@/utils/formatters', () => ({
  dateFormatter: vi.fn((date) => '2024-01-01')
}))

vi.mock('@fortawesome/free-solid-svg-icons', () => ({
  faFloppyDisk: 'faFloppyDisk',
  faPencil: 'faPencil',
  faTrash: 'faTrash'
}))

vi.mock('./components', () => ({
  TransferSummary: vi.fn(() => 'TransferSummary')
}))

describe('buttonConfigs', () => {
  describe('Helper Functions', () => {
    it('should create redOutlinedButton with correct config', () => {
      const result = redOutlinedButton('Test Label', 'testIcon')
      
      expect(result).toEqual({
        variant: 'outlined',
        color: 'error',
        iconColor: '#error',
        label: 'Test Label',
        startIcon: 'testIcon'
      })
    })

    it('should create outlinedButton with correct config', () => {
      const result = outlinedButton('Test Label', 'testIcon')
      
      expect(result).toEqual({
        variant: 'outlined',
        color: 'primary',
        label: 'Test Label',
        startIcon: 'testIcon'
      })
    })

    it('should create containedButton with correct config', () => {
      const result = containedButton('Test Label', 'testIcon')
      
      expect(result).toEqual({
        variant: 'contained',
        color: 'primary',
        iconColor: '#ffffff',
        label: 'Test Label',
        startIcon: 'testIcon'
      })
    })
  })

describe('buttonClusterConfigFn', () => {
  const t = vi.fn((key) => key)

  // Common mock data
  const toOrgData = []
  const methods = {
    getValues: vi.fn().mockReturnValue(1)
  }
  const setModalData = vi.fn()
  const createUpdateTransfer = vi.fn()
  const isGovernmentUser = false
  const recommendation = null
  let signingAuthorityDeclaration = false

  describe('When status is New', () => {
    it('should return saveDraft and signAndSend buttons', () => {
      const hasRoles = vi.fn().mockReturnValue(true)
      const hasAnyRole = vi.fn().mockReturnValue(true)
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const transferData = null // No transfer data in 'New' status

      // Call buttonClusterConfigFn with signingAuthorityDeclaration = false
      let config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      // Get the buttons for 'New' status
      let buttons = config[TRANSFER_STATUSES.NEW]

      // Expect the buttons to be saveDraft and signAndSend
      expect(buttons).toHaveLength(2)

      const saveDraftButton = buttons.find(
        (button) => button.id === 'save-draft-btn'
      )
      const signAndSendButton = buttons.find(
        (button) => button.id === 'sign-and-send-btn'
      )

      expect(saveDraftButton).toBeDefined()
      expect(signAndSendButton).toBeDefined()

      // signAndSend should be disabled because 'signingAuthorityDeclaration' is false
      expect(signAndSendButton.disabled).toBe(true)

      // Now, simulate that 'signingAuthorityDeclaration' is true
      signingAuthorityDeclaration = true

      // Call buttonClusterConfigFn again with updated signingAuthorityDeclaration
      config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      buttons = config[TRANSFER_STATUSES.NEW]

      const signAndSendButton2 = buttons.find(
        (button) => button.id === 'sign-and-send-btn'
      )

      // signAndSend should now be enabled
      expect(signAndSendButton2.disabled).toBe(false)
    })

    it('should disable signAndSend button if user lacks signing authority', () => {
      const hasRoles = vi.fn().mockReturnValue(false)
      const hasAnyRole = vi.fn().mockReturnValue(true)
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const transferData = null

      signingAuthorityDeclaration = true

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.NEW]

      const signAndSendButton = buttons.find(
        (button) => button.id === 'sign-and-send-btn'
      )

      expect(signAndSendButton.disabled).toBe(true)
    })
  })

  describe('When status is Draft', () => {
    const transferData = {
      currentStatus: {
        status: TRANSFER_STATUSES.DRAFT
      },
      agreementDate: new Date(),
      transferHistory: [],
      fromOrganization: {
        organizationId: 1
      }
    }

    it('should return deleteDraft, saveDraft, and signAndSend buttons', () => {
      const hasRoles = vi.fn().mockReturnValue(true)
      const hasAnyRole = vi.fn().mockReturnValue(true)
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }

      signingAuthorityDeclaration = false

      let config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      // Get the buttons for 'Draft' status
      let buttons = config[TRANSFER_STATUSES.DRAFT]

      // Expect the buttons to be deleteDraft, saveDraft, and signAndSend
      expect(buttons).toHaveLength(3)

      const deleteDraftButton = buttons.find(
        (button) => button.id === 'delete-draft-btn'
      )
      const saveDraftButton = buttons.find(
        (button) => button.id === 'save-draft-btn'
      )
      const signAndSendButton = buttons.find(
        (button) => button.id === 'sign-and-send-btn'
      )

      expect(deleteDraftButton).toBeDefined()
      expect(saveDraftButton).toBeDefined()
      expect(signAndSendButton).toBeDefined()

      // signAndSend should be disabled because 'signingAuthorityDeclaration' is false
      expect(signAndSendButton.disabled).toBe(true)

      // The other buttons should not be disabled
      expect(deleteDraftButton.disabled).toBeUndefined()
      expect(saveDraftButton.disabled).toBeUndefined()

      // Now, simulate that 'signingAuthorityDeclaration' is true
      signingAuthorityDeclaration = true

      // Call buttonClusterConfigFn again with updated signingAuthorityDeclaration
      config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      buttons = config[TRANSFER_STATUSES.DRAFT]

      const signAndSendButton2 = buttons.find(
        (button) => button.id === 'sign-and-send-btn'
      )

      // signAndSend should now be enabled
      expect(signAndSendButton2.disabled).toBe(false)
    })

    it('should disable signAndSend button if user lacks signing authority', () => {
      const hasRoles = vi.fn().mockReturnValue(false)
      const hasAnyRole = vi.fn().mockReturnValue(true)
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }

      signingAuthorityDeclaration = true

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.DRAFT]

      const signAndSendButton = buttons.find(
        (button) => button.id === 'sign-and-send-btn'
      )

      expect(signAndSendButton.disabled).toBe(true)
    })
  })

  describe('When status is Deleted', () => {
    it('should return an empty array', () => {
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const transferData = {
        currentStatus: {
          status: TRANSFER_STATUSES.DELETED
        },
        agreementDate: new Date(),
        transferHistory: []
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.DELETED]

      expect(buttons).toHaveLength(0)
    })
  })

  describe('When status is Rescinded', () => {
    it('should return an empty array', () => {
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const transferData = {
        currentStatus: {
          status: TRANSFER_STATUSES.RESCINDED
        },
        agreementDate: new Date(),
        transferHistory: []
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.RESCINDED]

      expect(buttons).toHaveLength(0)
    })
  })

  describe('When status is Declined', () => {
    it('should return an empty array', () => {
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const transferData = {
        currentStatus: {
          status: TRANSFER_STATUSES.DECLINED
        },
        agreementDate: new Date(),
        transferHistory: []
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.DECLINED]

      expect(buttons).toHaveLength(0)
    })
  })

  describe('When status is Refused', () => {
    it('should return an empty array', () => {
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const transferData = {
        currentStatus: {
          status: TRANSFER_STATUSES.REFUSED
        },
        agreementDate: new Date(),
        transferHistory: []
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.REFUSED]

      expect(buttons).toHaveLength(0)
    })
  })

  describe('When status is Sent', () => {
    const transferData = {
      currentStatus: {
        status: TRANSFER_STATUSES.SENT
      },
      agreementDate: new Date(),
      transferHistory: [],
      toOrganization: {
        organizationId: 2
      },
      fromOrganization: {
        organizationId: 1
      }
    }

    it('should return declineTransfer and signAndSubmit buttons for toOrganization user with roles', () => {
      const hasRoles = vi
        .fn()
        .mockImplementation((role) => role === roles.signing_authority)
      const hasAnyRole = vi
        .fn()
        .mockImplementation(
          (...rolesToCheck) =>
            rolesToCheck.includes(roles.transfers) ||
            rolesToCheck.includes(roles.signing_authority)
        )
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 2
        }
      }

      signingAuthorityDeclaration = false

      let config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      let buttons = config[TRANSFER_STATUSES.SENT]

      expect(buttons).toHaveLength(2)

      const declineTransferButton = buttons.find(
        (button) => button.id === 'decline-btn'
      )
      const signAndSubmitButton = buttons.find(
        (button) => button.id === 'sign-and-submit-btn'
      )

      expect(declineTransferButton).toBeDefined()
      expect(signAndSubmitButton).toBeDefined()

      // signAndSubmit should be disabled because 'signingAuthorityDeclaration' is false
      expect(signAndSubmitButton.disabled).toBe(true)

      // declineTransferButton should not be disabled
      expect(declineTransferButton.disabled).toBeUndefined()

      signingAuthorityDeclaration = true

      config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      buttons = config[TRANSFER_STATUSES.SENT]

      const signAndSubmitButton2 = buttons.find(
        (button) => button.id === 'sign-and-submit-btn'
      )

      // signAndSubmit should now be enabled
      expect(signAndSubmitButton2.disabled).toBe(false)
    })

    it('should return rescindTransfer button for fromOrganization user with signing_authority role', () => {
      const hasRoles = vi
        .fn()
        .mockImplementation((role) => role === roles.signing_authority)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.SENT]

      expect(buttons).toHaveLength(1)

      const rescindTransferButton = buttons.find(
        (button) => button.id === 'rescind-btn'
      )

      expect(rescindTransferButton).toBeDefined()
    })

    it('should not return any buttons for users without appropriate roles', () => {
      const hasRoles = vi.fn().mockReturnValue(false)
      const hasAnyRole = vi.fn().mockReturnValue(false)
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 3
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser: false,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.SENT]

      expect(buttons).toHaveLength(0)
    })
  })

  describe('When status is Submitted', () => {
    const transferData = {
      currentStatus: {
        status: TRANSFER_STATUSES.SUBMITTED
      },
      agreementDate: new Date(),
      transferHistory: [],
      fromOrganization: {
        organizationId: 1
      },
      toOrganization: {
        organizationId: 2
      }
    }

    it('should disable recommendTransfer button when recommendation is null', () => {
      const hasRoles = vi.fn().mockReturnValue(true)
      const hasAnyRole = vi.fn().mockReturnValue(true)
      const currentUser = {
        isGovernmentUser: true,
        organization: {
          organizationId: 3
        }
      }

      const recommendation = null

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser: true,
        recommendation,
        signingAuthorityDeclaration: false
      })

      const buttons = config[TRANSFER_STATUSES.SUBMITTED]
      const recommendButton = buttons.find(
        (button) => button.id === 'recommend-btn'
      )

      expect(recommendButton.disabled).toBe(true)
    })

    it('should enable recommendTransfer button when recommendation is not null', () => {
      const hasRoles = vi.fn().mockReturnValue(true)
      const hasAnyRole = vi.fn().mockReturnValue(true)
      const currentUser = {
        isGovernmentUser: true,
        organization: {
          organizationId: 3
        }
      }

      const recommendation = 'Some recommendation'

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser: true,
        recommendation,
        signingAuthorityDeclaration: false
      })

      const buttons = config[TRANSFER_STATUSES.SUBMITTED]
      const recommendButton = buttons.find(
        (button) => button.id === 'recommend-btn'
      )

      expect(recommendButton.disabled).toBe(false)
    })

    it('should enable "Recommend" button when recommendation is selected', () => {
      const hasRoles = vi.fn().mockReturnValue(true)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: true,
        organization: {
          organizationId: 1
        }
      }

      let recommendation = null

      let config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      let buttons = config[TRANSFER_STATUSES.SUBMITTED]

      const recommendButton = buttons.find(
        (button) => button.id === 'recommend-btn'
      )

      expect(recommendButton.disabled).toBe(true)

      recommendation = 'Record'

      config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      buttons = config[TRANSFER_STATUSES.SUBMITTED]

      const recommendButton2 = buttons.find(
        (button) => button.id === 'recommend-btn'
      )

      expect(recommendButton2.disabled).toBe(false)
    })

    it('should return rescindTransfer button for org user with signing_authority role', () => {
      const hasRoles = vi
        .fn()
        .mockImplementation((role) => role === roles.signing_authority)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.SUBMITTED]

      const rescindTransferButton = buttons.find(
        (button) => button.id === 'rescind-btn'
      )

      expect(rescindTransferButton).toBeDefined()
    })

    it('should not return rescindTransfer button for org user without signing_authority role', () => {
      const hasRoles = vi.fn().mockReturnValue(false)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.SUBMITTED]

      const rescindTransferButton = buttons.find(
        (button) => button.id === 'rescind-btn'
      )

      expect(rescindTransferButton).toBeUndefined()
    })
  })

  describe('When status is Recommended', () => {
    const transferData = {
      currentStatus: {
        status: TRANSFER_STATUSES.RECOMMENDED
      },
      agreementDate: new Date(),
      transferHistory: [],
      fromOrganization: {
        organizationId: 1
      },
      toOrganization: {
        organizationId: 2
      }
    }

    it('should return director buttons for government user with director role', () => {
      const hasRoles = vi
        .fn()
        .mockImplementation((role) => role === roles.director)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: true,
        organization: {
          organizationId: 3
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser: true,
        recommendation: null,
        signingAuthorityDeclaration: false
      })

      const buttons = config[TRANSFER_STATUSES.RECOMMENDED]

      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'refuse-btn' })
      )
      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'save-comment-btn' })
      )
      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'return-to-analyst-btn' })
      )
      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'record-btn' })
      )

      // Check that refuse and return-to-analyst buttons are not disabled
      const refuseButton = buttons.find((button) => button.id === 'refuse-btn')
      const returnToAnalystButton = buttons.find(
        (button) => button.id === 'return-to-analyst-btn'
      )
      expect(refuseButton.disabled).toBe(false)
      expect(returnToAnalystButton.disabled).toBe(false)
    })

    // Add a new test for the rescindTransfer button
    it('should return rescindTransfer button for org user with signing_authority role', () => {
      const hasRoles = vi
        .fn()
        .mockImplementation((role) => role === roles.signing_authority)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser: false,
        recommendation: null,
        signingAuthorityDeclaration: true
      })

      const buttons = config[TRANSFER_STATUSES.RECOMMENDED]
      const rescindTransferButton = buttons.find(
        (button) => button.id === 'rescind-btn'
      )

      expect(rescindTransferButton).toBeDefined()
      expect(rescindTransferButton.disabled).toBeUndefined()
    })

    it('should return director buttons for government user with director role', () => {
      const hasRoles = vi
        .fn()
        .mockImplementation((role) => role === roles.director)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: true,
        organization: {
          organizationId: 1
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.RECOMMENDED]

      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'refuse-btn' })
      )
      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'save-comment-btn' })
      )
      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'return-to-analyst-btn' })
      )
      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'record-btn' })
      )
    })

    it('should return rescindTransfer button for org user with signing_authority role', () => {
      const hasRoles = vi
        .fn()
        .mockImplementation((role) => role === roles.signing_authority)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.RECOMMENDED]

      const rescindTransferButton = buttons.find(
        (button) => button.id === 'rescind-btn'
      )

      expect(rescindTransferButton).toBeDefined()
    })

    it('should not return director buttons for government user without director role', () => {
      const hasRoles = vi.fn().mockReturnValue(false)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: true,
        organization: {
          organizationId: 1
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.RECOMMENDED]

      expect(buttons).not.toContainEqual(
        expect.objectContaining({ id: 'refuse-btn' })
      )
      expect(buttons).not.toContainEqual(
        expect.objectContaining({ id: 'return-to-analyst-btn' })
      )
      expect(buttons).not.toContainEqual(
        expect.objectContaining({ id: 'record-btn' })
      )
    })
  })

  describe('Button Handler Tests', () => {
    let mockParams

    beforeEach(() => {
      mockParams = {
        toOrgData: [{ organizationId: 2, name: 'Org 2' }],
        hasRoles: vi.fn(() => true),
        hasAnyRole: vi.fn(() => true),
        currentUser: { 
          organization: { organizationId: 1, name: 'From Org' },
          isGovernmentUser: false
        },
        methods: { getValues: vi.fn((key) => key === 'fromOrganizationId' ? 1 : 2) },
        t: vi.fn((key) => key),
        setModalData: vi.fn(),
        createUpdateTransfer: vi.fn(),
        transferData: {
          agreementDate: '2024-01-01',
          currentStatus: { status: 'SUBMITTED' },
          toOrganization: { organizationId: 2, name: 'To Org' },
          fromOrganization: { organizationId: 1, name: 'From Org' }
        },
        isGovernmentUser: false,
        recommendation: true,
        signingAuthorityDeclaration: true
      }
    })

    it('should call saveDraft handler correctly', () => {
      const result = buttonClusterConfigFn(mockParams)
      const formData = {
        fromOrganizationId: '1',
        toOrganizationId: '2',
        agreementDate: new Date('2024-01-01')
      }
      
      result.New[0].handler(formData)
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          fromOrganizationId: 1,
          toOrganizationId: 2,
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.DRAFT
        }
      })
    })

    it('should call deleteDraft handler correctly', () => {
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Draft[0].handler(formData)
      
      expect(mockParams.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'transfer:actionBtns.deleteDraftBtn',
        primaryButtonColor: 'error',
        secondaryButtonText: 'cancelBtn',
        title: 'confirmation',
        content: 'transfer:deleteConfirmText'
      })
    })

    it('should call signAndSend handler correctly', () => {
      const result = buttonClusterConfigFn(mockParams)
      const formData = { 
        agreementDate: new Date('2024-01-01'),
        quantity: 100,
        pricePerUnit: 25.00
      }
      
      result.New[1].handler(formData)
      
      expect(mockParams.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'transfer:actionBtns.signAndSendBtn',
        secondaryButtonText: 'cancelBtn',
        title: 'confirmation',
        content: expect.any(Object)
      })
    })

    it('should call signAndSubmit handler correctly', () => {
      mockParams.currentUser.organization.organizationId = 2
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.SENT
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Sent[1].handler(formData)
      
      expect(mockParams.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'transfer:actionBtns.signAndSubmitBtn',
        primaryButtonColor: 'primary',
        secondaryButtonText: 'cancelBtn',
        title: 'confirmation',
        content: 'transfer:submitConfirmText'
      })
    })

    it('should call declineTransfer handler correctly', () => {
      mockParams.currentUser.organization.organizationId = 2
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.SENT
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Sent[0].handler(formData)
      
      expect(mockParams.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'transfer:actionBtns.declineTransferBtn',
        primaryButtonColor: 'error',
        secondaryButtonText: 'cancelBtn',
        title: 'confirmation',
        content: 'transfer:declineConfirmText'
      })
    })

    it('should call rescindTransfer handler correctly', () => {
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.SUBMITTED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      // Find the rescind button
      const rescindButton = result.Submitted.find(btn => btn.id === 'rescind-btn')
      rescindButton.handler(formData)
      
      expect(mockParams.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'transfer:actionBtns.rescindTransferBtn',
        primaryButtonColor: 'error',
        secondaryButtonText: 'cancelBtn',
        title: 'confirmation',
        content: 'transfer:rescindConfirmText'
      })
    })

    it('should call saveComment handler correctly', () => {
      mockParams.isGovernmentUser = true
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.SUBMITTED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { data: 'test' }
      
      result.Submitted[0].handler(formData)
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          data: 'test',
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.SUBMITTED
        }
      })
    })

    it('should call refuseTransfer handler correctly', () => {
      mockParams.currentUser.isGovernmentUser = true
      mockParams.isGovernmentUser = true
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.RECOMMENDED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Recommended[0].handler(formData)
      
      expect(mockParams.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'transfer:actionBtns.refuseTransferBtn',
        primaryButtonColor: 'error',
        secondaryButtonText: 'cancelBtn',
        title: 'confirmation',
        content: 'transfer:refuseConfirmText',
        warningText: 'transfer:refuseWarningText'
      })
    })

    it('should call recordTransfer handler correctly', () => {
      mockParams.currentUser.isGovernmentUser = true
      mockParams.isGovernmentUser = true
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.RECOMMENDED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Recommended[3].handler(formData)
      
      expect(mockParams.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'transfer:actionBtns.recordTransferBtn',
        primaryButtonColor: 'primary',
        secondaryButtonText: 'cancelBtn',
        title: 'confirmation',
        content: 'transfer:recordConfirmText'
      })
    })

    it('should call recommendTransfer handler correctly', () => {
      mockParams.currentUser.isGovernmentUser = true
      mockParams.isGovernmentUser = true
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.SUBMITTED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Submitted[1].handler(formData)
      
      expect(mockParams.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'transfer:actionBtns.recommendBtn',
        primaryButtonColor: 'primary',
        secondaryButtonText: 'cancelBtn',
        title: 'confirmation',
        content: 'transfer:recommendConfirmText'
      })
    })

    it('should call returnToAnalyst handler correctly', () => {
      mockParams.currentUser.isGovernmentUser = true
      mockParams.isGovernmentUser = true
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.RECOMMENDED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Recommended[2].handler(formData)
      
      expect(mockParams.setModalData).toHaveBeenCalledWith({
        primaryButtonAction: expect.any(Function),
        primaryButtonText: 'transfer:actionBtns.returnToAnalystBtn',
        primaryButtonColor: 'error',
        secondaryButtonText: 'cancelBtn',
        title: 'confirmation',
        content: 'transfer:returnConfirmText',
        warningText: 'transfer:returnWarningText'
      })
    })

    it('should execute deleteDraft primaryButtonAction correctly', () => {
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Draft[0].handler(formData)
      
      // Execute the primaryButtonAction
      const modalCall = mockParams.setModalData.mock.calls[0][0]
      modalCall.primaryButtonAction()
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.DELETED
        }
      })
    })

    it('should execute signAndSend primaryButtonAction correctly', () => {
      const result = buttonClusterConfigFn(mockParams)
      const formData = {
        fromOrganizationId: '1',
        toOrganizationId: '2',
        agreementDate: new Date('2024-01-01'),
        quantity: 100,
        pricePerUnit: 25.00
      }
      
      result.New[1].handler(formData)
      
      // Execute the primaryButtonAction
      const modalCall = mockParams.setModalData.mock.calls[0][0]
      modalCall.primaryButtonAction()
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          fromOrganizationId: 1,
          toOrganizationId: 2,
          agreementDate: '2024-01-01',
          quantity: 100,
          pricePerUnit: 25,
          currentStatus: TRANSFER_STATUSES.SENT
        }
      })
    })

    it('should execute signAndSubmit primaryButtonAction correctly', () => {
      mockParams.currentUser.organization.organizationId = 2
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.SENT
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Sent[1].handler(formData)
      
      // Execute the primaryButtonAction
      const modalCall = mockParams.setModalData.mock.calls[0][0]
      modalCall.primaryButtonAction()
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.SUBMITTED
        }
      })
    })

    it('should execute declineTransfer primaryButtonAction correctly', () => {
      mockParams.currentUser.organization.organizationId = 2
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.SENT
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Sent[0].handler(formData)
      
      // Execute the primaryButtonAction
      const modalCall = mockParams.setModalData.mock.calls[0][0]
      modalCall.primaryButtonAction()
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.DECLINED
        }
      })
    })

    it('should execute rescindTransfer primaryButtonAction correctly', () => {
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.SUBMITTED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      const rescindButton = result.Submitted.find(btn => btn.id === 'rescind-btn')
      rescindButton.handler(formData)
      
      // Execute the primaryButtonAction
      const modalCall = mockParams.setModalData.mock.calls[0][0]
      modalCall.primaryButtonAction()
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.RESCINDED
        }
      })
    })

    it('should execute refuseTransfer primaryButtonAction correctly', () => {
      mockParams.currentUser.isGovernmentUser = true
      mockParams.isGovernmentUser = true
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.RECOMMENDED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Recommended[0].handler(formData)
      
      // Execute the primaryButtonAction
      const modalCall = mockParams.setModalData.mock.calls[0][0]
      modalCall.primaryButtonAction()
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.REFUSED
        }
      })
    })

    it('should execute recordTransfer primaryButtonAction correctly', () => {
      mockParams.currentUser.isGovernmentUser = true
      mockParams.isGovernmentUser = true
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.RECOMMENDED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Recommended[3].handler(formData)
      
      // Execute the primaryButtonAction
      const modalCall = mockParams.setModalData.mock.calls[0][0]
      modalCall.primaryButtonAction()
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.RECORDED
        }
      })
    })

    it('should execute recommendTransfer primaryButtonAction correctly', () => {
      mockParams.currentUser.isGovernmentUser = true
      mockParams.isGovernmentUser = true
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.SUBMITTED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Submitted[1].handler(formData)
      
      // Execute the primaryButtonAction
      const modalCall = mockParams.setModalData.mock.calls[0][0]
      modalCall.primaryButtonAction()
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.RECOMMENDED
        }
      })
    })

    it('should execute returnToAnalyst primaryButtonAction correctly', () => {
      mockParams.currentUser.isGovernmentUser = true
      mockParams.isGovernmentUser = true
      mockParams.transferData.currentStatus.status = TRANSFER_STATUSES.RECOMMENDED
      
      const result = buttonClusterConfigFn(mockParams)
      const formData = { agreementDate: new Date('2024-01-01') }
      
      result.Recommended[2].handler(formData)
      
      // Execute the primaryButtonAction
      const modalCall = mockParams.setModalData.mock.calls[0][0]
      modalCall.primaryButtonAction()
      
      expect(mockParams.createUpdateTransfer).toHaveBeenCalledWith({
        data: {
          agreementDate: '2024-01-01',
          currentStatus: TRANSFER_STATUSES.SUBMITTED
        }
      })
    })
  })

  describe('When status is Recorded', () => {
    it('should return an empty array', () => {
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const transferData = {
        currentStatus: {
          status: TRANSFER_STATUSES.RECORDED
        },
        agreementDate: new Date(),
        transferHistory: []
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      const buttons = config[TRANSFER_STATUSES.RECORDED]

      expect(buttons).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined transferData gracefully', () => {
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        undefined,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      expect(config).toBeDefined()
    })

    it('should handle undefined currentUser gracefully', () => {
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        undefined,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      expect(config).toBeDefined()
    })

    it('should handle undefined toOrgData gracefully', () => {
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: { organizationId: 1 }
      }

      const config = buttonClusterConfigFn({
        toOrgData: undefined,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        undefined,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      expect(config).toBeDefined()
    })

    it('should handle missing toOrganization in transferData', () => {
      const hasRoles = vi.fn(() => true)
      const hasAnyRole = vi.fn(() => true)
      const currentUser = {
        isGovernmentUser: false,
        organization: { organizationId: 1 }
      }
      const transferData = {
        currentStatus: { status: TRANSFER_STATUSES.SENT },
        agreementDate: new Date(),
        transferHistory: []
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        transferData,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      expect(config[TRANSFER_STATUSES.SENT]).toBeDefined()
    })

    it('should handle empty toOrgData array', () => {
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: { organizationId: 1 }
      }

      const config = buttonClusterConfigFn({
        toOrgData: [],
        hasRoles,
        hasAnyRole,
        currentUser,
        methods,
        t,
        setModalData,
        createUpdateTransfer,
        undefined,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      expect(config).toBeDefined()
    })
  })

  describe('Additional Branch Coverage', () => {
    it('should handle toOrganization lookup from toOrgData', () => {
      const toOrgData = [
        { organizationId: 1, name: 'Org 1' },
        { organizationId: 2, name: 'Org 2' }
      ]
      const methods = {
        getValues: vi.fn((key) => {
          if (key === 'toOrganizationId') return 2
          if (key === 'fromOrganizationId') return 1
          return null
        })
      }

      const config = buttonClusterConfigFn({
        toOrgData,
        hasRoles: vi.fn(() => true),
        hasAnyRole: vi.fn(() => true),
        currentUser: { organization: { organizationId: 1 } },
        methods,
        t: vi.fn((key) => key),
        setModalData: vi.fn(),
        createUpdateTransfer: vi.fn(),
        transferData: null,
        isGovernmentUser: false,
        recommendation: true,
        signingAuthorityDeclaration: true
      })

      expect(config).toBeDefined()
      expect(methods.getValues).toHaveBeenCalledWith('toOrganizationId')
      expect(methods.getValues).toHaveBeenCalledWith('fromOrganizationId')
    })

    it('should test disabled states based on roles', () => {
      const config = buttonClusterConfigFn({
        toOrgData: [],
        hasRoles: vi.fn(() => false), // No roles
        hasAnyRole: vi.fn(() => false),
        currentUser: { organization: { organizationId: 1 } },
        methods: { getValues: vi.fn(() => 1) },
        t: vi.fn((key) => key),
        setModalData: vi.fn(),
        createUpdateTransfer: vi.fn(),
        transferData: null,
        isGovernmentUser: false,
        recommendation: false,
        signingAuthorityDeclaration: false
      })

      // signAndSend should be disabled when user lacks roles or declaration
      expect(config.New[1].disabled).toBe(true)
    })

    it('should test isGovernmentUser flag usage', () => {
      const config = buttonClusterConfigFn({
        toOrgData: [],
        hasRoles: vi.fn(() => true),
        hasAnyRole: vi.fn(() => true),
        currentUser: { organization: { organizationId: 1 } },
        methods: { getValues: vi.fn(() => 1) },
        t: vi.fn((key) => key),
        setModalData: vi.fn(),
        createUpdateTransfer: vi.fn(),
        transferData: { agreementDate: '2024-01-01', currentStatus: { status: 'SUBMITTED' } },
        isGovernmentUser: false, // Not government user
        recommendation: true,
        signingAuthorityDeclaration: true
      })

      // saveComment should be disabled for non-government users
      const saveCommentBtn = config.Submitted.find(btn => btn.id === 'save-comment-btn')
      expect(saveCommentBtn?.disabled).toBe(true)
    })
  })

  describe('Director Delegated Authority', () => {
    const transferData = {
      currentStatus: {
        status: TRANSFER_STATUSES.SUBMITTED
      },
      agreementDate: new Date(),
      transferHistory: [],
      fromOrganization: {
        organizationId: 1
      },
      toOrganization: {
        organizationId: 2
      }
    }

    describe('Director Acting as Analyst', () => {
      it('should show "Recommend" button with correct tooltip for Director', () => {
        const hasRoles = vi
          .fn()
          .mockImplementation((role) => role === roles.director)
        const hasAnyRole = vi.fn().mockReturnValue(false)
        const currentUser = {
          isGovernmentUser: true,
          organization: {
            organizationId: 3
          }
        }

        const config = buttonClusterConfigFn({
          toOrgData,
          hasRoles,
          hasAnyRole,
          currentUser,
          methods,
          t,
          setModalData,
          createUpdateTransfer,
          transferData,
          isGovernmentUser: true,
          recommendation: 'Record',
          signingAuthorityDeclaration: false
        })

        const buttons = config[TRANSFER_STATUSES.SUBMITTED]
        const recommendButton = buttons.find(
          (btn) => btn.id === 'recommend-btn'
        )

        expect(recommendButton).toBeDefined()
        expect(recommendButton.tooltip).toBe('Acting as Analyst')
        expect(recommendButton.roleIndicator).toBe('Analyst')
      })

      it('should enable "Recommend" button when recommendation is provided', () => {
        const hasRoles = vi
          .fn()
          .mockImplementation((role) => role === roles.director)
        const hasAnyRole = vi.fn().mockReturnValue(false)
        const currentUser = {
          isGovernmentUser: true,
          organization: {
            organizationId: 3
          }
        }

        const config = buttonClusterConfigFn({
          toOrgData,
          hasRoles,
          hasAnyRole,
          currentUser,
          methods,
          t,
          setModalData,
          createUpdateTransfer,
          transferData,
          isGovernmentUser: true,
          recommendation: 'Record',
          signingAuthorityDeclaration: false
        })

        const buttons = config[TRANSFER_STATUSES.SUBMITTED]
        const recommendButton = buttons.find(
          (btn) => btn.id === 'recommend-btn'
        )

        expect(recommendButton.disabled).toBe(false)
      })

      it('should disable "Recommend" button when recommendation is not provided', () => {
        const hasRoles = vi
          .fn()
          .mockImplementation((role) => role === roles.director)
        const hasAnyRole = vi.fn().mockReturnValue(false)
        const currentUser = {
          isGovernmentUser: true,
          organization: {
            organizationId: 3
          }
        }

        const config = buttonClusterConfigFn({
          toOrgData,
          hasRoles,
          hasAnyRole,
          currentUser,
          methods,
          t,
          setModalData,
          createUpdateTransfer,
          transferData,
          isGovernmentUser: true,
          recommendation: null,
          signingAuthorityDeclaration: false
        })

        const buttons = config[TRANSFER_STATUSES.SUBMITTED]
        const recommendButton = buttons.find(
          (btn) => btn.id === 'recommend-btn'
        )

        expect(recommendButton.disabled).toBe(true)
      })
    })

    describe('Director Native Actions', () => {
      it('should show Director-level buttons without delegated authority indicator', () => {
        const hasRoles = vi
          .fn()
          .mockImplementation((role) => role === roles.director)
        const hasAnyRole = vi.fn().mockReturnValue(false)
        const currentUser = {
          isGovernmentUser: true,
          organization: {
            organizationId: 3
          }
        }

        const recommendedTransferData = {
          ...transferData,
          currentStatus: {
            status: TRANSFER_STATUSES.RECOMMENDED
          }
        }

        const config = buttonClusterConfigFn({
          toOrgData,
          hasRoles,
          hasAnyRole,
          currentUser,
          methods,
          t,
          setModalData,
          createUpdateTransfer,
          transferData: recommendedTransferData,
          isGovernmentUser: true,
          recommendation: null,
          signingAuthorityDeclaration: false
        })

        const buttons = config[TRANSFER_STATUSES.RECOMMENDED]

        const recordButton = buttons.find((btn) => btn.id === 'record-btn')
        const refuseButton = buttons.find((btn) => btn.id === 'refuse-btn')

        // Director native actions should not have tooltips or role indicators
        expect(recordButton).toBeDefined()
        expect(recordButton.tooltip).toBeUndefined()
        expect(recordButton.roleIndicator).toBeUndefined()

        expect(refuseButton).toBeDefined()
        expect(refuseButton.tooltip).toBeUndefined()
        expect(refuseButton.roleIndicator).toBeUndefined()
      })
    })

    describe('Comparison with Analyst', () => {
      it('should show same "Recommend" button but with tooltip for Director', () => {
        const currentUser = {
          isGovernmentUser: true,
          organization: {
            organizationId: 3
          }
        }

        // Test as Analyst
        const analystConfig = buttonClusterConfigFn({
          toOrgData,
          hasRoles: vi.fn().mockImplementation((role) => role === roles.analyst),
          hasAnyRole: vi.fn().mockReturnValue(false),
          currentUser,
          methods,
          t,
          setModalData,
          createUpdateTransfer,
          transferData,
          isGovernmentUser: true,
          recommendation: 'Record',
          signingAuthorityDeclaration: false
        })

        // Test as Director
        const directorConfig = buttonClusterConfigFn({
          toOrgData,
          hasRoles: vi
            .fn()
            .mockImplementation((role) => role === roles.director),
          hasAnyRole: vi.fn().mockReturnValue(false),
          currentUser,
          methods,
          t,
          setModalData,
          createUpdateTransfer,
          transferData,
          isGovernmentUser: true,
          recommendation: 'Record',
          signingAuthorityDeclaration: false
        })

        const analystButtons = analystConfig[TRANSFER_STATUSES.SUBMITTED]
        const directorButtons = directorConfig[TRANSFER_STATUSES.SUBMITTED]

        const analystRecommendButton = analystButtons.find(
          (btn) => btn.id === 'recommend-btn'
        )
        const directorRecommendButton = directorButtons.find(
          (btn) => btn.id === 'recommend-btn'
        )

        // Both should have the button
        expect(analystRecommendButton).toBeDefined()
        expect(directorRecommendButton).toBeDefined()

        // Director should have tooltip, Analyst should not
        expect(directorRecommendButton.tooltip).toBe('Acting as Analyst')
        expect(analystRecommendButton.tooltip).toBeFalsy()
      })
    })

    describe('Button Grouping', () => {
      it('should identify delegated authority buttons', () => {
        const hasRoles = vi
          .fn()
          .mockImplementation((role) => role === roles.director)
        const hasAnyRole = vi.fn().mockReturnValue(false)
        const currentUser = {
          isGovernmentUser: true,
          organization: {
            organizationId: 3
          }
        }

        const config = buttonClusterConfigFn({
          toOrgData,
          hasRoles,
          hasAnyRole,
          currentUser,
          methods,
          t,
          setModalData,
          createUpdateTransfer,
          transferData,
          isGovernmentUser: true,
          recommendation: 'Record',
          signingAuthorityDeclaration: false
        })

        const buttons = config[TRANSFER_STATUSES.SUBMITTED]
        const delegatedButtons = buttons.filter((btn) => btn.roleIndicator)

        expect(delegatedButtons.length).toBeGreaterThan(0)
        delegatedButtons.forEach((btn) => {
          expect(btn.tooltip).toBe('Acting as Analyst')
          expect(btn.roleIndicator).toBe('Analyst')
        })
      })
    })
  })
})
})
