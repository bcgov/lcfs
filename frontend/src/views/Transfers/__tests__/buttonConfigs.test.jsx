import { buttonClusterConfigFn } from '../buttonConfigs'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import { describe, expect, it, vi } from 'vitest'

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
      const transferData = null  // No transfer data in 'New' status

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

    it('should enable "Recommend" button when recommendation is selected', () => {
      const hasRoles = vi.fn().mockReturnValue(false)
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
        undefined,
        isGovernmentUser,
        recommendation,
        signingAuthorityDeclaration
      })

      expect(config).toBeDefined()
    })
  })
})
