import {
  faFloppyDisk,
  faPencil,
  faTrash,
  faCheck,
  faThumbsUp,
  faUndo
} from '@fortawesome/free-solid-svg-icons'
import { FUEL_CODE_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'

/**
 * This system manages button visibility based on:
 * - Current fuel code status (single source of truth)
 * - User roles and permissions
 * - Business rules and constraints
 */

// =============================================================================
// USER TYPE DETECTION
// =============================================================================

const USER_TYPES = {
  ANALYST: 'analyst',
  DIRECTOR: 'director'
}

function getUserType(context) {
  if (context.hasRoles && context.hasRoles(roles.director)) {
    return USER_TYPES.DIRECTOR
  }
  if (context.hasRoles && context.hasRoles(roles.analyst)) {
    return USER_TYPES.ANALYST
  }
  return null // Return null for unknown user types
}

// =============================================================================
// BUTTON STYLES
// =============================================================================

const BUTTON_STYLES = {
  PRIMARY_CONTAINED: { variant: 'contained', color: 'primary' },
  SUCCESS_CONTAINED: { variant: 'contained', color: 'success' },
  WARNING_CONTAINED: { variant: 'contained', color: 'warning' },
  PRIMARY_OUTLINED: { variant: 'outlined', color: 'primary' },
  ERROR_OUTLINED: { variant: 'outlined', color: 'error' },
  WARNING_OUTLINED: { variant: 'outlined', color: 'warning' }
}

// =============================================================================
// BUTTON ACTION FACTORY
// =============================================================================

class FuelCodeButtonActionFactory {
  constructor(context) {
    this.context = context
  }

  createButton(config) {
    return {
      ...config.style,
      id: config.id,
      label: config.label,
      startIcon: config.icon,
      disabled: config.disabled || false,
      handler: config.handler
    }
  }

  // Save action - for draft fuel codes
  save() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'save-fuel-code-btn',
      label: this.context.t('fuelCode:actionBtns.saveFuelCodeBtn'),
      icon: faFloppyDisk,
      disabled: this.context.hasValidationErrors, // || !this.context.hasChanges
      handler: () => this.context.handleSave()
    })
  }

  // Recommend to Director action - for analysts
  recommendToDirector() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'recommend-fuel-code-btn',
      label: this.context.t('fuelCode:actionBtns.recommendToDirectorBtn'),
      icon: faThumbsUp,
      disabled: this.context.hasValidationErrors,
      handler: () => this.context.handleRecommend()
    })
  }

  // Approve action - for directors
  approve() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'approve-fuel-code-btn',
      label: this.context.t('fuelCode:actionBtns.approveFuelCodeBtn'),
      icon: faCheck,
      disabled: this.context.hasValidationErrors,
      handler: () =>
        this.context.setModalData({
          primaryButtonAction: () => this.context.handleApprove(),
          primaryButtonText: this.context.t(
            'fuelCode:actionBtns.approveFuelCodeBtn'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('fuelCode:approveFuelCode'),
          content: this.context.t('fuelCode:approveConfirmText')
        })
    })
  }

  // Edit action - for editable fuel codes
  edit() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'edit-fuel-code-btn',
      label: this.context.t('fuelCode:actionBtns.editFuelCodeBtn'),
      icon: faPencil,
      handler: () => {
        if (this.context.currentStatus === FUEL_CODE_STATUSES.DRAFT)
          return this.context.handleEdit()

        return this.context.setModalData({
          primaryButtonAction: () => this.context.handleEdit(),
          primaryButtonText: this.context.t(
            'fuelCode:actionBtns.editFuelCodeBtn'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('fuelCode:editFuelCode'),
          content: this.context.t('fuelCode:editConfirmText')
        })
      }
    })
  }

  // Return to Analyst action - for managers/directors
  returnToAnalyst() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'return-to-analyst-btn',
      label: this.context.t('fuelCode:actionBtns.returnToAnalystBtn'),
      icon: faUndo,
      handler: () =>
        this.context.setModalData({
          primaryButtonAction: () => this.context.handleReturnToAnalyst(),
          primaryButtonText: this.context.t(
            'fuelCode:actionBtns.returnToAnalystBtn'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('fuelCode:returnToAnalyst'),
          content: this.context.t('fuelCode:returnToAnalystConfirmText')
        })
    })
  }

  // Delete action - for draft fuel codes
  delete() {
    return this.createButton({
      style: BUTTON_STYLES.ERROR_OUTLINED,
      id: 'delete-fuel-code-btn',
      label: this.context.t('fuelCode:actionBtns.deleteFuelCodeBtn'),
      icon: faTrash,
      disabled: !this.context.canDelete,
      handler: () =>
        this.context.setModalData({
          primaryButtonAction: () => this.context.handleDelete(),
          primaryButtonText: this.context.t(
            'fuelCode:actionBtns.deleteFuelCodeBtn'
          ),
          primaryButtonColor: 'error',
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('fuelCode:deleteFuelCode'),
          content: this.context.t('fuelCode:deleteConfirmText')
        })
    })
  }
}

// =============================================================================
// SIMPLIFIED BUTTON CONFIGURATION RULES
// =============================================================================

const FUEL_CODE_BUTTON_RULES = {
  [FUEL_CODE_STATUSES.DRAFT]: {
    [USER_TYPES.ANALYST]: ['edit', 'save', 'recommendToDirector', 'delete'],
    [USER_TYPES.DIRECTOR]: ['save', 'edit', 'approve']
  },

  [FUEL_CODE_STATUSES.RECOMMENDED]: {
    [USER_TYPES.ANALYST]: ['save'],
    [USER_TYPES.DIRECTOR]: ['save', 'edit', 'approve', 'returnToAnalyst']
  },

  [FUEL_CODE_STATUSES.APPROVED]: {
    [USER_TYPES.ANALYST]: ['save', 'edit'],
    [USER_TYPES.DIRECTOR]: ['edit']
  }
}

// =============================================================================
// CONDITION CHECKING
// =============================================================================

function shouldShowButton(buttonName, context) {
  switch (buttonName) {
    case 'save':
      // Show save button if in edit mode or creating new fuel code, and there are changes
      return context.shouldShowSaveButton
      //  && context.hasChanges

    case 'edit':
      // Show edit button if not in edit mode and fuel code exists
      return context.shouldShowEditButton

    case 'recommendToDirector':
      // Only show if fuel code is valid and ready for recommendation
      return !context.hasValidationErrors && context.isComplete

    case 'approve':
      // Only show if fuel code is valid and ready for approval
      return !context.hasValidationErrors && context.isComplete

    case 'returnToAnalyst':
      // Only show for recommended fuel codes that can be returned
      return context.currentStatus === FUEL_CODE_STATUSES.RECOMMENDED

    case 'delete':
      // Only show delete for draft fuel codes that can be deleted
      return context.canDelete && context.status === FUEL_CODE_STATUSES.DRAFT

    default:
      return true
  }
}

// =============================================================================
// MAIN CONFIGURATION FUNCTION
// =============================================================================

export const fuelCodeButtonConfigFn = (context) => {
  const actionFactory = new FuelCodeButtonActionFactory(context)
  const userType = getUserType(context)
  const currentStatus = context.currentStatus

  // If user type is unknown, return empty buttons array
  if (!userType) {
    return {
      [currentStatus]: []
    }
  }

  // Get buttons for current status and user type
  const statusRules = FUEL_CODE_BUTTON_RULES[currentStatus] || {}
  const userButtons = statusRules[userType] || []

  const buttons = []

  // Process each potential button
  for (const buttonName of userButtons) {
    // Check if button should be shown based on conditions
    if (!shouldShowButton(buttonName, context)) {
      continue
    }

    // Create the button
    const button = actionFactory[buttonName]?.()
    if (button) {
      buttons.push(button)
    }
  }

  return {
    [currentStatus]: buttons
  }
}

// =============================================================================
// CONTEXT BUILDER HELPER
// =============================================================================

export const buildFuelCodeButtonContext = ({
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
  hasChanges = false,
  hasValidationErrors = false,
  isComplete = true,
  canEdit = true,
  canDelete = true,
  shouldShowEditButton = false,
  shouldShowSaveButton = false,
  isInEditMode = false,
  isUpdating = false,
  isButtonOperationInProgress = false,
  currentButtonOperation = null
}) => ({
  currentStatus: fuelCode?.fuelCodeStatus?.status || FUEL_CODE_STATUSES.DRAFT,
  hasRoles,
  t,
  setModalData,
  handleSave,
  handleRecommend,
  handleApprove,
  handleEdit,
  handleDelete,
  handleReturnToAnalyst,
  hasChanges,
  hasValidationErrors,
  isComplete,
  canEdit,
  canDelete,
  shouldShowEditButton,
  shouldShowSaveButton,
  isInEditMode,
  isUpdating,
  isButtonOperationInProgress,
  currentButtonOperation,
  status: fuelCode?.fuelCodeStatus?.status
})
