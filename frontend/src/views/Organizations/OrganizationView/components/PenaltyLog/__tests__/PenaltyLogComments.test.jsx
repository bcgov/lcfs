import { screen } from '@testing-library/react'
import { describe, expect, vi } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import { PenaltyLog } from '../PenaltyLog'

const state = vi.hoisted(() => ({ government: true }))
vi.mock('react-router-dom', () => ({ useParams: () => ({ orgID: '7' }) }))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { organization: { organizationId: 99 } },
    isLoading: false,
    hasAnyRole: () => state.government
  })
}))
vi.mock('@/hooks/useOrganization', () => ({
  useOrganizationPenaltyAnalytics: () => ({ data: {} })
}))
vi.mock('echarts/core', () => ({ use: vi.fn() }))
vi.mock('../../_charts', () => ({
  usePenaltyMixOption: vi.fn(),
  useSparklineOption: vi.fn(),
  useStackedBarOption: vi.fn()
}))
vi.mock('../PenaltyComponents', () => ({
  MetricCardsSection: () => null,
  PenaltySummaryTable: () => null,
  StackedBarChart: () => null
}))
vi.mock('../PenaltyGrids', () => ({
  AutomaticPenaltyLogGrid: () => null,
  DiscretionaryPenaltyLogGrid: () => null
}))
vi.mock('@/components/Comments', () => ({
  default: (props) => (
    <div
      data-test="penalty-comments"
      data-entity-type={props.entityType}
      data-entity-id={props.entityId}
      data-attachments={props.enableAttachments}
      data-upload-dropzone={props.showUploadDropzone}
      data-deletion={props.enableDeletion}
      data-show-title={props.showTitle}
      data-placeholder={props.placeholder}
    />
  )
}))
describe('Organization Penalty Log comments', () => {
  test('shows the organization thread with attachments and deletion for IDIR users', ({
    render,
    theme,
    i18n
  }) => {
    state.government = true
    render(<PenaltyLog />, [theme, i18n])
    const comments = screen.getByTestId('penalty-comments')
    expect(comments).toHaveAttribute('data-entity-type', 'penaltyLog')
    expect(comments).toHaveAttribute('data-entity-id', '7')
    expect(comments).toHaveAttribute('data-attachments', 'true')
    expect(comments).toHaveAttribute('data-upload-dropzone', 'true')
    expect(comments).toHaveAttribute('data-deletion', 'true')
    expect(comments).toHaveAttribute('data-show-title', 'false')
    expect(comments).toHaveAttribute(
      'data-placeholder',
      'Add a penalty log comment'
    )
  })
  test('hides internal penalty comments from suppliers', ({
    render,
    theme
  }) => {
    state.government = false
    render(<PenaltyLog />, [theme])
    expect(screen.queryByTestId('penalty-comments')).not.toBeInTheDocument()
  })
})
