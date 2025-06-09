import colors from '@/themes/base/colors'

export const changelogCellStyle = (params, key) => {
  if (params.data.actionType === 'UPDATE' && params.data.diff?.includes(key)) {
    const style = { backgroundColor: colors.alerts.warning.background }
    if (params.data.updated) {
      style.textDecoration = 'line-through'
    }
    return style
  }
  if (params.data.actionType === 'DELETE') {
    return {
      textDecoration: 'line-through'
    }
  }
}

export const changelogRowStyle = (params, isSupplemental) => {
  // For CREATE actions, only show green background if it's a new supplemental entry in supplemental mode
  if (
    params.data.actionType === 'CREATE' &&
    params.data.isNewSupplementalEntry &&
    isSupplemental
  ) {
    return {
      backgroundColor: colors.alerts.success.background
    }
  }
  
  // For UPDATE actions, only show yellow background if it's a new supplemental entry in supplemental mode
  if (
    params.data.actionType === 'UPDATE' &&
    params.data.isNewSupplementalEntry &&
    isSupplemental
  ) {
    return {
      backgroundColor: colors.alerts.warning.background
    }
  }
  
  // For DELETE actions, only show red background if it's a new supplemental entry in supplemental mode
  if (
    params.data.actionType === 'DELETE' &&
    params.data.isNewSupplementalEntry &&
    isSupplemental
  ) {
    return {
      backgroundColor: colors.alerts.error.background
    }
  }
  
  // No row-level styling for other cases (prevents highlighting all rows in edit mode)
  return {}
}

