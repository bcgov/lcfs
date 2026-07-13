import type { ChipProps } from '@mui/material'
import { CONFIG } from '@/constants/config'
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

export const analystReviewAssistantName = CONFIG.ANALYST_REVIEW_ASSISTANT_NAME

export const robotVariants: RobotVariant[] = [
  {
    name: `${analystReviewAssistantName} review`,
    color: '#0f766e',
    background: '#ccfbf1'
  },
  {
    name: `${analystReviewAssistantName} summary`,
    color: '#1d4ed8',
    background: '#dbeafe'
  },
  {
    name: `${analystReviewAssistantName} triage`,
    color: '#7c3aed',
    background: '#ede9fe'
  }
]
