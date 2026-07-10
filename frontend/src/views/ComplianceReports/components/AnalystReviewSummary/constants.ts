import type { ChipProps } from '@mui/material'
import type { ReviewSectionStatus, ReviewSeverity, RobotVariant } from './types'

export const severityColor: Record<ReviewSeverity, ChipProps['color']> = {
  concern: 'error',
  review: 'warning',
  informational: 'info'
}

export const sectionColor: Record<ReviewSectionStatus, ChipProps['color']> = {
  concern: 'error',
  review: 'warning',
  clear: 'success'
}

export const robotVariants: RobotVariant[] = [
  { name: 'Methy review', color: '#0f766e', background: '#ccfbf1' },
  { name: 'Methy summary', color: '#1d4ed8', background: '#dbeafe' },
  { name: 'Methy triage', color: '#7c3aed', background: '#ede9fe' }
]
