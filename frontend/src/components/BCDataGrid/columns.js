import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { ActionsRenderer, ValidationRenderer2 } from './components'
import colors from '@/themes/base/colors'

export const validation = {
  colId: 'validation',
  cellRenderer: ValidationRenderer2,
  cellStyle: {
    padding: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  pinned: 'left',
  width: 40,
  editable: false,
  suppressKeyboardEvent,
  filter: false
}

export const actions = (props) => ({
  colId: 'action',
  headerName: 'Action',
  cellRenderer: ActionsRenderer,
  cellRendererParams: props,
  cellStyle: (params) => {
    // Apply yellow background to Action column for edited rows in supplemental reports
    if (
      params.data.isNewSupplementalEntry &&
      params.data.actionType === 'UPDATE'
    ) {
      return { backgroundColor: colors.alerts.warning.background }
    }
    // Don't override row-level styling for CREATE actions (let the green row background show through)
    if (
      params.data.isNewSupplementalEntry &&
      params.data.actionType === 'CREATE'
    ) {
      return { backgroundColor: colors.alerts.success.background }
    }
    if (
      params.data.isNewSupplementalEntry &&
      params.data.actionType === 'DELETE'
    ) {
      return { backgroundColor: colors.alerts.error.background }
    }
    return {}
  },
  pinned: 'left',
  maxWidth: 200,
  minWidth: 150,
  editable: false,
  suppressKeyboardEvent,
  filter: false,
  hide: props.hide
})
