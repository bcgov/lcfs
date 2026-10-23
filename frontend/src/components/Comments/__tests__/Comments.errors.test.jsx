import { screen } from '@testing-library/react'
import { expect, vi } from 'vitest'
import { test } from '@/tests/utils/fixtures'
import Comments from '../index'

const state = vi.hoisted(() => ({ error: null }))
vi.mock('@/hooks/useComments', () => ({
  useComments: () => ({ comments: [], mutationError: state.error })
}))
vi.mock('@/hooks/useMentionableUsers', () => ({
  useMentionableUsers: () => ({ data: [] })
}))
vi.mock('../CommentList', () => ({ default: () => null }))

test.for([
  { detail: 'File type is not allowed.', message: 'File type is not allowed.' },
  {
    detail: [
      {
        loc: ['body', 'entityId'],
        msg: 'Input should be a valid integer',
        type: 'int_parsing'
      }
    ],
    message: 'Input should be a valid integer'
  },
  { detail: { unexpected: 'shape' }, message: 'Request failed' }
])(
  'displays API errors without rendering response objects: $message',
  ({ detail, message }, { render, theme, i18n }) => {
    state.error = { response: { data: { detail } }, message: 'Request failed' }
    render(<Comments entityType="penaltyLog" entityId={7} />, [theme, i18n])
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  }
)
