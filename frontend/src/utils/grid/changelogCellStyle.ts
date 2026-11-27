import type { CellStyle } from 'ag-grid-community'
import colors from '@/themes/base/colors'

export interface ChangelogGridRow {
  id?: string | number
  actionType?: string
  diff?: string[]
  updated?: boolean
  isNewSupplementalEntry?: boolean
}

type ChangelogCellParams = { data?: ChangelogGridRow }

type ChangelogRowParams = { data?: ChangelogGridRow }

export const changelogCellStyle = (
  params: ChangelogCellParams,
  key: string
): CellStyle | undefined => {
  const data = params.data!
  if (data.actionType === 'UPDATE' && data.diff?.includes(key)) {
    const style: CellStyle = {
      backgroundColor: colors.alerts.warning.background
    }
    if (data.updated) {
      style.textDecoration = 'line-through'
    }
    return style
  }
  if (data.actionType === 'DELETE') {
    return { textDecoration: 'line-through' }
  }
}

export const changelogRowStyle = (
  params: ChangelogRowParams,
  isSupplemental: boolean
): CellStyle => {
  const data = params.data!
  if (
    data.actionType === 'CREATE' &&
    data.isNewSupplementalEntry &&
    isSupplemental
  ) {
    return { backgroundColor: colors.alerts.success.background }
  }
  if (
    data.actionType === 'UPDATE' &&
    data.isNewSupplementalEntry &&
    isSupplemental
  ) {
    return { backgroundColor: colors.alerts.warning.background }
  }
  if (
    data.actionType === 'DELETE' &&
    data.isNewSupplementalEntry &&
    isSupplemental
  ) {
    return { backgroundColor: colors.alerts.error.background }
  }
  return {}
}
