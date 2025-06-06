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
  // For CREATE actions, always show green background for the entire row
  if (params.data.actionType === 'CREATE') {
    return {
      backgroundColor: colors.alerts.success.background
    }
  }
  
  // For DELETE actions, always show red background for the entire row
  if (params.data.actionType === 'DELETE') {
    return {
      backgroundColor: colors.alerts.error.background
    }
  }
  
  // No row-level styling for other cases (empty rows, UPDATE actions, etc.)
  return {}
}

