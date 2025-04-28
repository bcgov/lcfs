import { suppressKeyboardEvent } from '@/utils/grid/eventHandlers'
import { ActionsRenderer, ValidationRenderer2 } from './components'

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
  pinned: 'left',
  maxWidth: 200,
  minWidth: 150,
  editable: false,
  suppressKeyboardEvent,
  filter: false,
  hide: props.hide
})
