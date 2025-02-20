import colors from '@/themes/base/colors'

export const changelogCellStyle = (params, key) => {
  if (params.data.actionType === 'UPDATE' && params.data.diff?.[key]) {
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
