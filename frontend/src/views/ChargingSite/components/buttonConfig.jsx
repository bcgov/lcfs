import { CheckBox, CheckBoxOutlineBlank } from '@mui/icons-material'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { roles, govRoles } from '@/constants/roles'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFilterCircleXmark } from '@fortawesome/free-solid-svg-icons'

// =============================================================================
// USER TYPE DETECTION
// =============================================================================

const USER_TYPES = {
  BCEID_USER: 'bceid_user',
  BCEID_MANAGER: 'bceid_manager',
  IDIR_ANALYST: 'idir_analyst',
  IDIR_MANAGER: 'idir_manager',
  IDIR_ADMIN: 'idir_admin'
}

function getUserType(context) {
  const isGovernmentUser = context.hasAnyRole && context.hasAnyRole(...govRoles)

  if (isGovernmentUser) {
    if (context.hasRoles && context.hasRoles(roles.fs_admin))
      return USER_TYPES.IDIR_ADMIN
    if (context.hasRoles && context.hasRoles(roles.compliance_manager))
      return USER_TYPES.IDIR_MANAGER
    if (context.hasRoles && context.hasRoles(roles.analyst))
      return USER_TYPES.IDIR_ANALYST
    return USER_TYPES.IDIR_ANALYST
  } else {
    if (context.hasRoles && context.hasRoles(roles.compliance_reporting))
      return USER_TYPES.BCEID_MANAGER
    return USER_TYPES.BCEID_USER
  }
}

// =============================================================================
// BUTTON STYLES
// =============================================================================

const BUTTON_STYLES = {
  PRIMARY_CONTAINED: { variant: 'contained', color: 'primary' },
  PRIMARY_OUTLINED: { variant: 'outlined', color: 'primary' },
  ERROR_OUTLINED: { variant: 'outlined', color: 'error' },
  WARNING_OUTLINED: { variant: 'outlined', color: 'warning' }
}

// =============================================================================
// BUTTON ACTION FACTORY
// =============================================================================

class ButtonActionFactory {
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
      handler: config.handler,
      title: config.tooltip || ''
    }
  }

  // Select Actions with Toggle Functionality
  selectAllSubmitted() {
    const submittedEquipment = this.context.equipmentList.filter(
      (e) => e.status.status === 'Submitted'
    )
    const submittedIds = submittedEquipment.map((eq) => eq.chargingEquipmentId)
    const allSubmittedSelected =
      submittedIds.length > 0 &&
      submittedIds.every((id) => this.context.selectedRows.includes(id))

    return this.createButton({
      style: allSubmittedSelected
        ? BUTTON_STYLES.WARNING_OUTLINED
        : BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'select-all-submitted-btn',
      label: allSubmittedSelected
        ? this.context.t('chargingSite:buttons.unselectAllSubmitted')
        : this.context.t('chargingSite:buttons.selectAllSubmitted'),
      icon: allSubmittedSelected ? (
        <CheckBoxOutlineBlank sx={{ width: '24px', height: '24px' }} />
      ) : (
        <CheckBox sx={{ width: '24px', height: '24px' }} />
      ),
      disabled: submittedEquipment.length === 0,
      handler: () =>
        this.context.handleToggleSelectByStatus(EQUIPMENT_STATUSES.SUBMITTED)
    })
  }

  selectAllDraft() {
    const draftEquipment = this.context.equipmentList.filter(
      (e) => e.status.status === 'Draft'
    )
    const draftIds = draftEquipment.map((eq) => eq.chargingEquipmentId)
    const allDraftSelected =
      draftIds.length > 0 &&
      draftIds.every((id) => this.context.selectedRows.includes(id))

    return this.createButton({
      style: allDraftSelected
        ? BUTTON_STYLES.WARNING_OUTLINED
        : BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'select-all-draft-btn',
      label: allDraftSelected
        ? this.context.t('chargingSite:buttons.unselectAllDraft')
        : this.context.t('chargingSite:buttons.selectAllDraft'),
      icon: allDraftSelected ? (
        <CheckBoxOutlineBlank sx={{ width: '24px', height: '24px' }} />
      ) : (
        <CheckBox sx={{ width: '24px', height: '24px' }} />
      ),
      disabled: draftEquipment.length === 0,
      handler: () =>
        this.context.handleToggleSelectByStatus(EQUIPMENT_STATUSES.DRAFT)
    })
  }

  selectAllValidated() {
    const validatedEquipment = this.context.equipmentList.filter(
      (e) => e.status.status === 'Validated'
    )
    const validatedIds = validatedEquipment.map((eq) => eq.chargingEquipmentId)
    const allValidatedSelected =
      validatedIds.length > 0 &&
      validatedIds.every((id) => this.context.selectedRows.includes(id))

    return this.createButton({
      style: allValidatedSelected
        ? BUTTON_STYLES.WARNING_OUTLINED
        : BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'select-all-validated-btn',
      label: allValidatedSelected
        ? this.context.t('chargingSite:buttons.unselectAllValidated')
        : this.context.t('chargingSite:buttons.selectAllValidated'),
      icon: allValidatedSelected ? (
        <CheckBoxOutlineBlank sx={{ width: '24px', height: '24px' }} />
      ) : (
        <CheckBox sx={{ width: '24px', height: '24px' }} />
      ),
      disabled: validatedEquipment.length === 0,
      handler: () =>
        this.context.handleToggleSelectByStatus(EQUIPMENT_STATUSES.VALIDATED)
    })
  }

  // Status Update Actions
  setSelectedAsSubmitted() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'submit-selected-btn',
      label: this.context.t('chargingSite:buttons.setSelectedAsSubmitted'),
      disabled:
        this.context.selectedRows.length === 0 ||
        this.context.isUpdating ||
        !this.context.canSubmit,
      tooltip:
        this.context.selectedRows.length > 0 && !this.context.canSubmit
          ? this.context.t('chargingSite:tooltips.onlyDraftCanBeSubmitted')
          : '',
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.handleBulkStatusUpdate(EQUIPMENT_STATUSES.SUBMITTED),
          primaryButtonText: this.context.t(
            'chargingSite:buttons.setSelectedAsSubmitted'
          ),
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t(
            'chargingSite:setSelectedAsSubmittedConfirmTxt'
          )
        })
    })
  }
  setSelectedAsValidated() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'validate-selected-btn',
      label: this.context.t('chargingSite:buttons.setSelectedAsValidated'),
      disabled:
        this.context.selectedRows.length === 0 ||
        this.context.isUpdating ||
        !this.context.canValidate,
      tooltip:
        this.context.selectedRows.length > 0 && !this.context.canValidate
          ? this.context.t('chargingSite:tooltips.onlySubmittedCanBeValidated')
          : '',
      handler: () =>
        this.context.handleBulkStatusUpdate(EQUIPMENT_STATUSES.VALIDATED)
    })
  }
  setToDecommission() {
    return this.createButton({
      style: BUTTON_STYLES.ERROR_OUTLINED,
      id: 'decommission-btn',
      label: this.context.t('chargingSite:buttons.setToDecommission'),
      disabled:
        this.context.selectedRows.length === 0 ||
        this.context.isUpdating ||
        !this.context.canSetToDecommission,
      tooltip:
        this.context.selectedRows.length > 0 &&
        !this.context.canSetToDecommission
          ? this.context.t(
              'chargingSite:tooltips.onlyValidatedCanBeDecommissioned'
            )
          : '',
      handler: (formData) =>
        this.context.setModalData({
          primaryButtonAction: () =>
            this.context.handleBulkStatusUpdate(
              EQUIPMENT_STATUSES.DECOMMISSIONED
            ),
          primaryButtonText: this.context.t(
            'chargingSite:buttons.setToDecommission'
          ),
          primaryButtonColor: 'error',
          secondaryButtonText: this.context.t('cancelBtn'),
          title: this.context.t('confirmation'),
          content: this.context.t('chargingSite:setToDecommissionConfirmTxt')
        })
    })
  }
  undoValidation() {
    return this.createButton({
      style: BUTTON_STYLES.WARNING_OUTLINED,
      id: 'undo-validation-btn',
      label: this.context.t('chargingSite:buttons.undoValidation'),
      disabled:
        this.context.selectedRows.length === 0 ||
        this.context.isUpdating ||
        !this.context.canUndoValidation,
      tooltip:
        this.context.selectedRows.length > 0 && !this.context.canUndoValidation
          ? this.context.t('chargingSite:tooltips.onlyValidatedCanBeReturned')
          : '',
      handler: () =>
        this.context.handleBulkStatusUpdate(EQUIPMENT_STATUSES.SUBMITTED)
    })
  }

  returnSelectedToDraft() {
    return this.createButton({
      style: BUTTON_STYLES.ERROR_OUTLINED,
      id: 'return-to-draft-btn',
      label: this.context.t('chargingSite:buttons.returnSelectedToDraft'),
      disabled:
        this.context.selectedRows.length === 0 ||
        this.context.isUpdating ||
        !this.context.canReturnToDraft,
      tooltip:
        this.context.selectedRows.length > 0 && !this.context.canReturnToDraft
          ? this.context.t('chargingSite:tooltips.onlySubmittedCanBeDraft')
          : '',
      handler: () =>
        this.context.handleBulkStatusUpdate(EQUIPMENT_STATUSES.DRAFT)
    })
  }
  clearFilters() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      icon: (
        <FontAwesomeIcon icon={faFilterCircleXmark} className="small-icon" />
      ),
      id: 'clear-filters-btn',
      label: this.context.t('chargingSite:buttons.clearFilters'),
      handler: this.context.handleClearFilters
    })
  }

  createFSE() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'create-fse-btn',
      label: this.context.t('chargingSite:buttons.newFSE'),
      handler: this.context.handleCreateFSE
    })
  }
}

// =============================================================================
// EQUIPMENT STATUS CONSTANTS
// =============================================================================

const EQUIPMENT_STATUSES = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  VALIDATED: 'Validated',
  UPDATED: 'Updated',
  DECOMMISSIONED: 'Decommissioned'
}

// =============================================================================
// BUTTON RULES CONFIGURATION
// =============================================================================

const BUTTON_RULES = {
  // When equipment has mixed statuses or general view
  // TODO: Modify the rules as required based on workflow
  DEFAULT: {
    [USER_TYPES.BCEID_USER]: [
      'createFSE',
      'selectAllDraft',
      'returnSelectedToDraft',
      'clearFilters'
    ],
    [USER_TYPES.BCEID_MANAGER]: [
      'createFSE',
      'selectAllDraft',
      'setSelectedAsSubmitted',
      'selectAllValidated',
      'setToDecommission',
      'clearFilters'
    ],
    [USER_TYPES.IDIR_ANALYST]: [
      'selectAllSubmitted',
      'setSelectedAsValidated',
      'undoValidation',
      'returnSelectedToDraft',
      'clearFilters'
    ],
    [USER_TYPES.IDIR_MANAGER]: [
      'selectAllSubmitted',
      'setSelectedAsValidated',
      'undoValidation',
      'returnSelectedToDraft',
      'clearFilters'
    ],
    [USER_TYPES.IDIR_ADMIN]: [
      'selectAllSubmitted',
      'setSelectedAsValidated',
      'undoValidation',
      'returnSelectedToDraft',
      'clearFilters'
    ]
  }
}

// =============================================================================
// CONDITION CHECKING
// =============================================================================

function shouldShowButton(buttonName, context) {
  const { chargingSiteStatus, organizationId, currentUser } = context

  switch (buttonName) {
    case 'createFSE':
      // Only show for non-government users (BCeID)
      return !context.isGovernmentUser
    case 'selectAllSubmitted':
      // Only show if there are submitted equipment
      return context.isGovernmentUser
    case 'selectAllDraft':
    case 'selectAllValidated':
      if (!context.isGovernmentUser) {
        return true
      }

    case 'setSelectedAsValidated':
      // Only analysts and above can validate
      // Only show if some equipment is selected and can be validated
      return (
        (context.selectedRows.length > 0 && context.canValidate) ||
        context.isGovernmentUser
      )

    case 'undoValidation':
      // Only analysts and above can undo validation
      // Only show if some equipment is selected and can be undone
      return (
        (context.selectedRows.length > 0 && context.canUndoValidation) ||
        context.isGovernmentUser
      )

    case 'returnSelectedToDraft':
      // BCeID users can only modify their own organization's equipment
      if (!context.isGovernmentUser) {
        return false
      }
      return (
        (context.selectedRows.length > 0 && context.canReturnToDraft) ||
        context.isGovernmentUser
      )

    case 'clearFilters':
      // Always show clear filters
      return true

    default:
      return true
  }
}

// =============================================================================
// MAIN CONFIGURATION FUNCTION
// =============================================================================

export const equipmentButtonConfigFn = (context) => {
  const actionFactory = new ButtonActionFactory(context)
  const userType = getUserType(context)

  // Get buttons for the user type (using DEFAULT since equipment can have mixed statuses)
  const userButtons = BUTTON_RULES.DEFAULT[userType] || []

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

  return buttons
}

// =============================================================================
// CONTEXT BUILDER HELPER
// =============================================================================

export const buildButtonContext = ({
  t,
  setModalData,
  equipmentList,
  selectedRows,
  isUpdating,
  canValidate,
  canUndoValidation,
  canReturnToDraft,
  canSubmit,
  canSetToDecommission,
  chargingSiteStatus,
  organizationId,
  currentUser,
  hasAnyRole,
  hasRoles,
  handleToggleSelectByStatus,
  handleBulkStatusUpdate,
  handleClearFilters,
  handleCreateFSE
}) => {
  const isGovernmentUser = hasAnyRole && hasAnyRole(...govRoles)

  return {
    t,
    setModalData,
    equipmentList,
    selectedRows,
    isUpdating,
    canValidate,
    canUndoValidation,
    canReturnToDraft,
    canSubmit,
    canSetToDecommission,
    chargingSiteStatus,
    organizationId,
    currentUser,
    isGovernmentUser,
    hasAnyRole,
    hasRoles,
    handleToggleSelectByStatus,
    handleBulkStatusUpdate,
    handleClearFilters,
    handleCreateFSE
  }
}
