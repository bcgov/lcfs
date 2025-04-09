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
  if (
    params.data.actionType === 'CREATE' &&
    params.data.isNewSupplementalEntry &&
    isSupplemental
  ) {
    return {
      backgroundColor: colors.alerts.success.background
    }
  }
  if (
    params.data.actionType === 'UPDATE' &&
    params.data.isNewSupplementalEntry &&
    isSupplemental
  ) {
    return {
      backgroundColor: colors.alerts.warning.background
    }
  }
  if (
    params.data.actionType === 'DELETE' &&
    params.data.isNewSupplementalEntry &&
    isSupplemental
  ) {
    return {
      backgroundColor: colors.alerts.error.background
    }
  } else {
    return {}
  }
}
