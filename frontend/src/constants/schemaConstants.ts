export const ACTION_STATUS_MAP = {
  UPDATE: 'Edit',
  DELETE: 'Delete',
  CREATE: 'New'
} as const

export type ActionStatus =
  (typeof ACTION_STATUS_MAP)[keyof typeof ACTION_STATUS_MAP]
