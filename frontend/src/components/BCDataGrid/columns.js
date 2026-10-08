import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { ActionsRenderer } from './components/Renderers/ActionsRenderer'
import { ValidationRenderer2 } from './components/Renderers/ValidationRenderer2'
import colors from '@/themes/base/colors'
/** @type {import('ag-grid-community').ColDef} */
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

/**
 * @param {Partial<Pick<import('./components/Renderers/ActionsRenderer').ActionsRendererProps, 'enableDuplicate' | 'enableEdit' | 'enableDelete' | 'enableUndo' | 'enableStatus'>> & { hide?: boolean } | ((params: import('ag-grid-community').ICellRendererParams) => Partial<Pick<import('./components/Renderers/ActionsRenderer').ActionsRendererProps, 'enableDuplicate' | 'enableEdit' | 'enableDelete' | 'enableUndo' | 'enableStatus'>>)
 * @returns {import('ag-grid-community').ColDef}
 */
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
    // Apply green background to Action column for added rows in supplemental reports
    if (
      params.data.isNewSupplementalEntry &&
      params.data.actionType === 'CREATE'
    ) {
      return { backgroundColor: colors.alerts.success.background }
    }
    // Apply red background to Action column for deleted rows in supplemental reports
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
  hide: typeof props === 'function' ? undefined : props.hide
})
