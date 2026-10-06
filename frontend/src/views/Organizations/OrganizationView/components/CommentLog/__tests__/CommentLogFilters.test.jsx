import { screen, fireEvent, act } from '@testing-library/react'
import { useCallback, useState } from 'react'
import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { test } from '@/tests/utils/fixtures'
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
      categories={['Compliance notes', 'Organization changes']}
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

  test('clears the search input and does not re-apply the stale value', ({
    render,
    theme
  }) => {
    const onApply = vi.fn()
    const { container } = render(<Harness onApply={onApply} />, [theme])
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

  test('labels the category combobox and exposes keyboard selection state', ({
    render,
    theme
  }) => {
    const onApply = vi.fn()
    render(<Harness onApply={onApply} />, [theme])

    const category = screen.getByRole('combobox', {
      name: /internalComment:log\.filters\.categoryLabel/
    })
    expect(category).toHaveAttribute('aria-expanded', 'false')
    act(() => category.focus())
    expect(category).toHaveFocus()

    // MUI keeps DOM focus on the combobox and moves its active descendant
    // through the listbox as the user presses the arrow keys.
    fireEvent.keyDown(category, { key: 'ArrowDown' })
    expect(category).toHaveAttribute('aria-expanded', 'true')
    const listbox = screen.getByRole('listbox', {
      name: /internalComment:log\.filters\.categoryLabel/
    })
    expect(category).toHaveAttribute('aria-controls', listbox.id)
    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'Compliance notes',
      'Organization changes'
    ])

    fireEvent.keyDown(category, { key: 'ArrowDown' })
    const activeOptionId = category.getAttribute('aria-activedescendant')
    expect(options[0]).toHaveAttribute('id', activeOptionId)

    fireEvent.keyDown(category, { key: 'ArrowDown' })
    const secondActiveOptionId = category.getAttribute('aria-activedescendant')
    expect(options[1]).toHaveAttribute('id', secondActiveOptionId)
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
    expect(category).toHaveFocus()

    fireEvent.keyDown(category, { key: 'Enter' })
    expect(onApply).toHaveBeenLastCalledWith('category', 'Organization changes')
    expect(category).toHaveValue('Organization changes')
    expect(category).toHaveAttribute('aria-expanded', 'false')
    expect(category).toHaveFocus()

    fireEvent.keyDown(category, { key: 'ArrowDown' })
    expect(
      screen.getByRole('option', { name: 'Organization changes' })
    ).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(category, { key: 'Escape' })
    expect(category).toHaveAttribute('aria-expanded', 'false')
    expect(category).toHaveValue('Organization changes')
    expect(category).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('gives each visible filter label to its control', ({
    render,
    theme
  }) => {
    render(<Harness onApply={vi.fn()} />, [theme])

    expect(
      screen.getByRole('textbox', {
        name: /internalComment:log\.filters\.searchLabel/
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', {
        name: /internalComment:log\.filters\.categoryLabel/
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', {
        name: /internalComment:log\.filters\.yearLabel/
      })
    ).toBeInTheDocument()
  })
})
