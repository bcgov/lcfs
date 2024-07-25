import { suppressKeyboardEvent } from '@/utils/eventHandlers'
import { ActionsRenderer2, ValidationRenderer2 } from './components'

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
  cellRenderer: ActionsRenderer2,
  cellRendererParams: props,
  pinned: 'left',
  maxWidth: 110,
  editable: false,
  suppressKeyboardEvent,
  filter: false
})