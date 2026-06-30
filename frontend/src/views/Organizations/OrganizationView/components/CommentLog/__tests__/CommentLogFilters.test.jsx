import { render, screen, fireEvent, act } from '@testing-library/react'
import { useCallback, useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { wrapper } from '@/tests/utils/wrapper'
import { CommentLogFilters } from '../CommentLogFilters'

// Predictable translations; keys are fine for querying.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}))

/**
 * Harness that mimics useOrganizationComments: `setFilter` closes over
 * `filters`, so its identity changes whenever filters change. That identity
 * change is exactly what used to re-fire the debounced-commit effect with a
 * stale value after "Clear all filters".
 */
const Harness = ({ onApply }) => {
  const [filters, setFilters] = useState({
    category: null,
    complianceYear: null,
    search: ''
  })
  const setFilter = useCallback(
    (key, value) => {
      onApply(key, value)
      setFilters((f) => ({ ...f, [key]: value }))
    },
    [filters, onApply]
  )
  const clearFilters = useCallback(() => {
    setFilters({ category: null, complianceYear: null, search: '' })
  }, [])
  return (
    <CommentLogFilters
      filters={filters}
      setFilter={setFilter}
      clearFilters={clearFilters}
      categories={['Compliance notes']}
      years={[2025, 2024]}
    />
  )
}

const searchInput = (container) =>
  container.querySelector('[data-test="comment-log-search"] input')

describe('CommentLogFilters — Clear all filters', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    act(() => vi.runOnlyPendingTimers())
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('clears the search input and does not re-apply the stale value', () => {
    const onApply = vi.fn()
    const { container } = render(<Harness onApply={onApply} />, { wrapper })
    const input = searchInput(container)

    // Type and let the debounce commit the search.
    fireEvent.change(input, { target: { value: 'test' } })
    act(() => vi.advanceTimersByTime(300))
    expect(input.value).toBe('test')
    expect(onApply).toHaveBeenLastCalledWith('search', 'test')

    // Click "Clear all filters".
    const clearBtn = screen.getByRole('button', { name: /ClearFilters/i })
    act(() => fireEvent.click(clearBtn))
    // Flush the debounce that follows the input reset.
    act(() => vi.advanceTimersByTime(300))

    // Input is empty and the search was NOT re-applied to the stale "test".
    expect(input.value).toBe('')
    expect(onApply).not.toHaveBeenLastCalledWith('search', 'test')
  })
})
