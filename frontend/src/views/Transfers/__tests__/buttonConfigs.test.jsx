// src/views/Transfers/__tests__/buttonConfigs.test.jsx

import { buttonClusterConfigFn } from '../buttonConfigs'
import { TRANSFER_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import { describe, expect, it, vi } from 'vitest'

describe('buttonClusterConfigFn', () => {
  const t = vi.fn((key) => key)

  describe('When status is New', () => {
    it('should return saveDraft and signAndSend buttons', () => {
      // Mock dependencies
      const toOrgData = []
      const hasRoles = vi.fn().mockReturnValue(true)
      const hasAnyRole = vi.fn().mockReturnValue(true)
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const methods = {
        getValues: vi.fn().mockReturnValue(1)
      }
      const setModalData = vi.fn()
      const createUpdateTransfer = vi.fn()
      const transferData = null // No transfer data in 'New' status
      const isGovernmentUser = false

      // Initially, signingAuthorityDeclaration is false
      let signingAuthorityDeclaration = false
      const recommendation = null

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
  })

  describe('When status is Draft', () => {
    it('should return deleteDraft, saveDraft, and signAndSend buttons', () => {
      // Mock dependencies
      const toOrgData = []
      const hasRoles = vi.fn().mockReturnValue(true)
      const hasAnyRole = vi.fn().mockReturnValue(true)
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const methods = {
        getValues: vi.fn().mockReturnValue(1)
      }
      const setModalData = vi.fn()
      const createUpdateTransfer = vi.fn()
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
      const isGovernmentUser = false

      // Initially, signingAuthorityDeclaration is false
      let signingAuthorityDeclaration = false
      const recommendation = null

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
  })

  describe('When status is Sent', () => {
    it('should return declineTransfer and signAndSubmit buttons for toOrganization user with roles', () => {
      // Mock dependencies
      const toOrgData = []
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
          organizationId: 2 // toOrganizationId
        }
      }
      const methods = {
        getValues: vi.fn().mockReturnValue(1)
      }
      const setModalData = vi.fn()
      const createUpdateTransfer = vi.fn()
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
      const isGovernmentUser = false

      // Initially, signingAuthorityDeclaration is false
      let signingAuthorityDeclaration = false
      const recommendation = null

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

      // Get the buttons for 'Sent' status
      let buttons = config[TRANSFER_STATUSES.SENT]

      // Expect the buttons to be declineTransfer and signAndSubmit
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

      buttons = config[TRANSFER_STATUSES.SENT]

      const signAndSubmitButton2 = buttons.find(
        (button) => button.id === 'sign-and-submit-btn'
      )

      // signAndSubmit should now be enabled
      expect(signAndSubmitButton2.disabled).toBe(false)
    })

    it('should return rescindTransfer button for fromOrganization user with signing_authority role', () => {
      // Mock dependencies
      const toOrgData = []
      const hasRoles = vi
        .fn()
        .mockImplementation((role) => role === roles.signing_authority)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1 // fromOrgId
        }
      }
      const methods = {
        getValues: vi.fn().mockReturnValue(1)
      }
      const setModalData = vi.fn()
      const createUpdateTransfer = vi.fn()
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
      const isGovernmentUser = false

      const recommendation = null
      const signingAuthorityDeclaration = false

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

      // Get the buttons for 'Sent' status
      const buttons = config[TRANSFER_STATUSES.SENT]

      // Expect the button to be rescindTransfer
      expect(buttons).toHaveLength(1)

      const rescindTransferButton = buttons.find(
        (button) => button.id === 'rescind-btn'
      )

      expect(rescindTransferButton).toBeDefined()
    })
  })

  describe('When status is Submitted', () => {
    it('should enable "Recommend" button when recommendation is selected', () => {
      // Mock dependencies
      const toOrgData = []
      const hasRoles = vi.fn().mockReturnValue(false)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: true,
        organization: {
          organizationId: 1
        }
      }
      const methods = {
        getValues: vi.fn()
      }
      const setModalData = vi.fn()
      const createUpdateTransfer = vi.fn()
      const transferData = {
        currentStatus: {
          status: TRANSFER_STATUSES.SUBMITTED
        },
        agreementDate: new Date(),
        transferHistory: []
      }
      const isGovernmentUser = true

      // Initially, recommendation is null
      let recommendation = null
      const signingAuthorityDeclaration = false

      // Call buttonClusterConfigFn with recommendation = null
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

      // Get the buttons for 'Submitted' status
      let buttons = config[TRANSFER_STATUSES.SUBMITTED]

      // Expect the buttons to be saveComment and recommendTransfer
      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'save-comment-btn' })
      )
      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'recommend-btn' })
      )

      const recommendButton = buttons.find(
        (button) => button.id === 'recommend-btn'
      )

      // Expect the 'Recommend' button to be disabled because 'recommendation' is not selected
      expect(recommendButton.disabled).toBe(true)

      // Now, simulate that 'recommendation' is selected
      recommendation = 'Record'

      // Call buttonClusterConfigFn again with updated recommendation
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

      // 'Recommend' button should now be enabled
      expect(recommendButton2.disabled).toBe(false)
    })

    it('should return rescindTransfer button for org user with signing_authority role', () => {
      // Mock dependencies
      const toOrgData = []
      const hasRoles = vi
        .fn()
        .mockImplementation((role) => role === roles.signing_authority)
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1 // fromOrgId
        }
      }
      const methods = {
        getValues: vi.fn().mockReturnValue(1)
      }
      const setModalData = vi.fn()
      const createUpdateTransfer = vi.fn()
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
      const isGovernmentUser = false

      const recommendation = null
      const signingAuthorityDeclaration = false

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

      // Get the buttons for 'Submitted' status
      const buttons = config[TRANSFER_STATUSES.SUBMITTED]

      // Expect the button to be rescindTransfer
      expect(buttons).toContainEqual(
        expect.objectContaining({ id: 'rescind-btn' })
      )
    })
  })

  describe('When status is Recommended', () => {
    it('should return director buttons for government user with director role', () => {
      // Mock dependencies
      const toOrgData = []
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
      const methods = {
        getValues: vi.fn()
      }
      const setModalData = vi.fn()
      const createUpdateTransfer = vi.fn()
      const transferData = {
        currentStatus: {
          status: TRANSFER_STATUSES.RECOMMENDED
        },
        agreementDate: new Date(),
        transferHistory: []
      }
      const isGovernmentUser = true

      const recommendation = null
      const signingAuthorityDeclaration = false

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

      // Get the buttons for 'Recommended' status
      const buttons = config[TRANSFER_STATUSES.RECOMMENDED]

      // Expect the buttons to be refuseTransfer, saveComment, returnToAnalyst, recordTransfer
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
  })

  describe('When status is Recorded', () => {
    it('should return an empty array', () => {
      // Mock dependencies
      const toOrgData = []
      const hasRoles = vi.fn()
      const hasAnyRole = vi.fn()
      const currentUser = {
        isGovernmentUser: false,
        organization: {
          organizationId: 1
        }
      }
      const methods = {
        getValues: vi.fn()
      }
      const setModalData = vi.fn()
      const createUpdateTransfer = vi.fn()
      const transferData = {
        currentStatus: {
          status: TRANSFER_STATUSES.RECORDED
        },
        agreementDate: new Date(),
        transferHistory: []
      }
      const isGovernmentUser = false

      const recommendation = null
      const signingAuthorityDeclaration = false

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

      // Get the buttons for 'Recorded' status
      const buttons = config[TRANSFER_STATUSES.RECORDED]

      // Expect the buttons array to be empty
      expect(buttons).toHaveLength(0)
    })
  })
})
