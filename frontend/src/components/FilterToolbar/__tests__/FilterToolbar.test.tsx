import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, vi, beforeEach } from 'vitest'
import { FilterToolbar } from '../FilterToolbar'
import { test } from '@/tests/utils/fixtures'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'common:ClearFilters' ? 'Clear Filters' : key)
  })
}))

describe('FilterToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    test('returns null when there is nothing to render', ({
      render,
      theme
    }) => {
      const { container } = render(<FilterToolbar />, [theme])

      expect(container.firstChild).toBeNull()
    })

    test('renders filter pills', ({ render, theme }) => {
      render(
        <FilterToolbar
          pills={[
            {
              id: 'status-draft',
              label: 'Status',
              value: 'Draft',
              onRemove: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByText('Status: Draft')).toBeInTheDocument()
    })

    test('renders select filters with labels', ({ render, theme }) => {
      render(
        <FilterToolbar
          selectFilters={[
            {
              id: 'status-filter',
              label: 'Status',
              placeholder: 'Select status',
              value: null,
              options: ['Draft', 'Submitted'],
              onChange: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Select status')).toBeInTheDocument()
    })

    test('renders clear all button when onClearAll is provided', ({
      render,
      theme
    }) => {
      render(<FilterToolbar onClearAll={vi.fn()} />, [theme])

      expect(
        screen.getByRole('button', { name: 'Clear Filters' })
      ).toBeInTheDocument()
    })
  })

  describe('filter application', () => {
    test('calls onChange when a select filter option is chosen', async ({
      render,
      theme
    }) => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      render(
        <FilterToolbar
          selectFilters={[
            {
              id: 'status-filter',
              placeholder: 'Select status',
              value: null,
              options: ['Draft', 'Submitted'],
              onChange
            }
          ]}
        />,
        [theme]
      )

      await user.click(screen.getByPlaceholderText('Select status'))
      await user.click(screen.getByRole('option', { name: 'Submitted' }))

      expect(onChange).toHaveBeenCalledWith('Submitted')
    })

    test('calls onRemove when a pill delete button is clicked', async ({
      render,
      theme
    }) => {
      const user = userEvent.setup()
      const onRemove = vi.fn()

      render(
        <FilterToolbar
          pills={[
            {
              id: 'status-draft',
              label: 'Status',
              value: 'Draft',
              onRemove
            }
          ]}
        />,
        [theme]
      )

      const chip = screen.getByRole('button', { name: 'Status: Draft' })
      const deleteIcon = chip.querySelector('.MuiChip-deleteIcon')

      expect(deleteIcon).not.toBeNull()
      await user.click(deleteIcon as Element)

      expect(onRemove).toHaveBeenCalledTimes(1)
    })

    test('calls onClearAll when clear filters button is clicked', async ({
      render,
      theme
    }) => {
      const user = userEvent.setup()
      const onClearAll = vi.fn()

      render(<FilterToolbar onClearAll={onClearAll} />, [theme])

      await user.click(screen.getByRole('button', { name: 'Clear Filters' }))

      expect(onClearAll).toHaveBeenCalledTimes(1)
    })

    test('does not call onClearAll when clear all is disabled', ({
      render,
      theme
    }) => {
      const onClearAll = vi.fn()

      render(<FilterToolbar onClearAll={onClearAll} clearAllDisabled />, [
        theme
      ])

      expect(
        screen.getByRole('button', { name: 'Clear Filters' })
      ).toBeDisabled()
      expect(onClearAll).not.toHaveBeenCalled()
    })

    test('handles multiple select filters', ({ render, theme }) => {
      render(
        <FilterToolbar
          selectFilters={[
            {
              id: 'filter1',
              label: 'Filter 1',
              placeholder: 'Select 1',
              value: null,
              options: ['A', 'B'],
              onChange: vi.fn()
            },
            {
              id: 'filter2',
              label: 'Filter 2',
              placeholder: 'Select 2',
              value: null,
              options: ['X', 'Y'],
              onChange: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByText('Filter 1')).toBeInTheDocument()
      expect(screen.getByText('Filter 2')).toBeInTheDocument()
    })

    test('handles multiple pills', ({ render, theme }) => {
      render(
        <FilterToolbar
          pills={[
            { id: 'pill1', label: 'Filter 1', value: 'A', onRemove: vi.fn() },
            { id: 'pill2', label: 'Filter 2', value: 'B', onRemove: vi.fn() }
          ]}
        />,
        [theme]
      )

      expect(screen.getByText('Filter 1: A')).toBeInTheDocument()
      expect(screen.getByText('Filter 2: B')).toBeInTheDocument()
    })
  })

  describe('pill types and styling', () => {
    test('renders preset type pills', ({ render, theme }) => {
      render(
        <FilterToolbar
          pills={[
            {
              id: 'preset-pill',
              label: 'Preset',
              value: 'Value',
              type: 'preset',
              onRemove: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByText('Preset: Value')).toBeInTheDocument()
    })

    test('renders select type pills', ({ render, theme }) => {
      render(
        <FilterToolbar
          pills={[
            {
              id: 'select-pill',
              label: 'Select',
              value: 'Value',
              type: 'select',
              onRemove: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByText('Select: Value')).toBeInTheDocument()
    })

    test('renders sort type pills with sort direction', ({ render, theme }) => {
      const { container } = render(
        <FilterToolbar
          pills={[
            {
              id: 'sort-pill',
              label: 'Name',
              sortDirection: 'asc',
              type: 'sort',
              onRemove: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(
        container.querySelector('[data-testid="ArrowDropUpIcon"]')
      ).toBeInTheDocument()
    })

    test('renders sort pills with descending direction', ({
      render,
      theme
    }) => {
      const { container } = render(
        <FilterToolbar
          pills={[
            {
              id: 'sort-pill',
              label: 'Date',
              sortDirection: 'desc',
              type: 'sort',
              onRemove: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(
        container.querySelector('[data-testid="ArrowDropDownIcon"]')
      ).toBeInTheDocument()
    })

    test('renders pill with custom renderContent', ({ render, theme }) => {
      render(
        <FilterToolbar
          pills={[
            {
              id: 'custom-pill',
              label: 'Custom',
              value: 'Value',
              renderContent: (pill) => <span>Custom: {pill.value}</span>,
              onRemove: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByText('Custom: Value')).toBeInTheDocument()
    })
  })

  describe('select filter options', () => {
    test('handles filter with loading state', ({ render, theme }) => {
      render(
        <FilterToolbar
          selectFilters={[
            {
              id: 'loading-filter',
              placeholder: 'Loading...',
              value: null,
              options: [],
              isLoading: true,
              onChange: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByPlaceholderText('Loading...')).toBeInTheDocument()
    })

    test('handles disabled filter', ({ render, theme }) => {
      render(
        <FilterToolbar
          selectFilters={[
            {
              id: 'disabled-filter',
              placeholder: 'Disabled',
              value: null,
              options: ['A', 'B'],
              disabled: true,
              onChange: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
    })

    test('handles filter without label', ({ render, theme }) => {
      render(
        <FilterToolbar
          selectFilters={[
            {
              id: 'no-label-filter',
              placeholder: 'No label',
              value: null,
              options: ['A', 'B'],
              onChange: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByPlaceholderText('No label')).toBeInTheDocument()
    })

    test('handles filter with custom width', ({ render, theme }) => {
      const { container } = render(
        <FilterToolbar
          selectFilters={[
            {
              id: 'wide-filter',
              placeholder: 'Wide filter',
              value: null,
              options: ['A'],
              width: 400,
              onChange: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(
        container.querySelector('.MuiAutocomplete-root')
      ).toBeInTheDocument()
    })

    test('handles multiple select filter', ({ render, theme }) => {
      render(
        <FilterToolbar
          selectFilters={[
            {
              id: 'multi-filter',
              placeholder: 'Select multiple',
              value: [],
              options: ['A', 'B', 'C'],
              multiple: true,
              onChange: vi.fn()
            }
          ]}
        />,
        [theme]
      )

      expect(screen.getByPlaceholderText('Select multiple')).toBeInTheDocument()
    })
  })

  describe('showClearAll behavior', () => {
    test('shows clear all by default when onClearAll provided', ({
      render,
      theme
    }) => {
      render(<FilterToolbar onClearAll={vi.fn()} />, [theme])

      expect(
        screen.getByRole('button', { name: 'Clear Filters' })
      ).toBeInTheDocument()
    })

    test('hides clear all when showClearAll is false', ({ render, theme }) => {
      render(<FilterToolbar onClearAll={vi.fn()} showClearAll={false} />, [
        theme
      ])

      expect(
        screen.queryByRole('button', { name: 'Clear Filters' })
      ).not.toBeInTheDocument()
    })

    test('does not render clear all when onClearAll not provided', ({
      render,
      theme
    }) => {
      render(
        <FilterToolbar
          pills={[{ id: '1', label: 'Test', onRemove: vi.fn() }]}
        />,
        [theme]
      )

      expect(
        screen.queryByRole('button', { name: 'Clear Filters' })
      ).not.toBeInTheDocument()
    })
  })

  describe('custom styling', () => {
    test('accepts custom sx prop', ({ render, theme }) => {
      const { container } = render(
        <FilterToolbar
          pills={[{ id: '1', label: 'Test', onRemove: vi.fn() }]}
          sx={{ padding: 4 }}
        />,
        [theme]
      )

      expect(container.querySelector('.filter-toolbar')).toBeInTheDocument()
    })

    test('accepts sx as array', ({ render, theme }) => {
      const { container } = render(
        <FilterToolbar
          pills={[{ id: '1', label: 'Test', onRemove: vi.fn() }]}
          sx={[{ padding: 2 }, { margin: 1 }]}
        />,
        [theme]
      )

      expect(container.querySelector('.filter-toolbar')).toBeInTheDocument()
    })
  })
})
