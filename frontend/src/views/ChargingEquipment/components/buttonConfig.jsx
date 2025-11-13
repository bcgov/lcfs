import { AddCircleOutlineRounded, CheckBox } from '@mui/icons-material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFilterCircleXmark } from '@fortawesome/free-solid-svg-icons'

const BUTTON_STYLES = {
  PRIMARY_CONTAINED: { variant: 'contained', color: 'primary' },
  PRIMARY_OUTLINED: { variant: 'outlined', color: 'primary' },
  ERROR_OUTLINED: { variant: 'outlined', color: 'error' }
}

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

  // New FSE
  addFse() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'new-fse-btn',
      label: this.context.t('chargingEquipment:newFSE'),
      icon: <AddCircleOutlineRounded sx={{ width: '24px', height: '24px' }} />,
      handler: this.context.handleNewFSE
    })
  }

  // Select toggles
  selectAllDraftUpdated() {
    const draftOrUpdated = this.context.equipmentList.filter(
      (e) => e.status === 'Draft' || e.status === 'Updated'
    )
    const ids = draftOrUpdated.map((e) => e.charging_equipment_id)
    const allSelected = ids.length > 0 && ids.every((id) => this.context.selectedRows.includes(id))

    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'select-all-draft-updated-btn',
      label: this.context.t('chargingEquipment:selectAllDraftUpdated'),
      icon: <CheckBox sx={{ width: '24px', height: '24px' }} />,
      disabled: ids.length === 0,
      handler: () => this.context.handleToggleSelectByStatus(['Draft', 'Updated'])
    })
  }

  selectAllValidated() {
    const validated = this.context.equipmentList.filter((e) => e.status === 'Validated')
    const ids = validated.map((e) => e.charging_equipment_id)
    const allSelected = ids.length > 0 && ids.every((id) => this.context.selectedRows.includes(id))
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_CONTAINED,
      id: 'select-all-validated-btn',
      label: this.context.t('chargingEquipment:selectAllValidated'),
      icon: <CheckBox sx={{ width: '24px', height: '24px' }} />,
      disabled: ids.length === 0,
      handler: () => this.context.handleToggleSelectByStatus(['Validated'])
    })
  }

  // Status actions (submit / decommission)
  submitSelected() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'submit-selected-btn',
      label: this.context.t('chargingEquipment:submitSelected'),
      disabled: this.context.selectedRows.length === 0 || !this.context.canSubmit,
      handler: () => this.context.setShowSubmitModal(true)
    })
  }

  setToDecommission() {
    return this.createButton({
      style: BUTTON_STYLES.ERROR_OUTLINED,
      id: 'decommission-btn',
      label: this.context.t('chargingEquipment:setToDecommissioned'),
      disabled: this.context.selectedRows.length === 0 || !this.context.canDecommission,
      handler: () => this.context.setShowDecommissionModal(true)
    })
  }

  clearFilters() {
    return this.createButton({
      style: BUTTON_STYLES.PRIMARY_OUTLINED,
      id: 'clear-filters-btn',
      label: this.context.t('chargingEquipment:clearFilters'),
      icon: <FontAwesomeIcon icon={faFilterCircleXmark} className="small-icon" />,
      handler: this.context.handleClearFilters
    })
  }
}

export const fseButtonConfigFn = (context) => {
  const factory = new ButtonActionFactory(context)
  // Order for BCeID users on Manage FSE
  const buttons = [
    factory.addFse(),
    factory.selectAllDraftUpdated(),
    factory.selectAllValidated(),
    factory.submitSelected(),
    factory.setToDecommission(),
    factory.clearFilters()
  ]
  return buttons
}

export const buildFseButtonContext = ({
  t,
  equipmentList,
  selectedRows,
  canSubmit,
  canDecommission,
  setShowSubmitModal,
  setShowDecommissionModal,
  handleToggleSelectByStatus,
  handleNewFSE,
  handleClearFilters
}) => ({
  t,
  equipmentList,
  selectedRows,
  canSubmit,
  canDecommission,
  setShowSubmitModal,
  setShowDecommissionModal,
  handleToggleSelectByStatus,
  handleNewFSE,
  handleClearFilters
})


