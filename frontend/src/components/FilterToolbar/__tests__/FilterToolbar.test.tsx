import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterToolbar } from '../FilterToolbar'
import { wrapper } from '@/tests/utils/wrapper'

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
    it('returns null when there is nothing to render', () => {
      const { container } = render(<FilterToolbar />, { wrapper })

      expect(container.firstChild).toBeNull()
    })

    it('renders filter pills', () => {
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
        { wrapper }
      )

      expect(screen.getByText('Status: Draft')).toBeInTheDocument()
    })

    it('renders select filters with labels', () => {
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
        { wrapper }
      )

      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Select status')).toBeInTheDocument()
    })

    it('renders clear all button when onClearAll is provided', () => {
      render(<FilterToolbar onClearAll={vi.fn()} />, { wrapper })

      expect(
        screen.getByRole('button', { name: 'Clear Filters' })
      ).toBeInTheDocument()
    })
  })

  describe('filter application', () => {
    it('calls onChange when a select filter option is chosen', async () => {
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
        { wrapper }
      )

      await user.click(screen.getByPlaceholderText('Select status'))
      await user.click(screen.getByRole('option', { name: 'Submitted' }))

      expect(onChange).toHaveBeenCalledWith('Submitted')
    })

    it('calls onRemove when a pill delete button is clicked', async () => {
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
        { wrapper }
      )

      const chip = screen.getByRole('button', { name: 'Status: Draft' })
      const deleteIcon = chip.querySelector('.MuiChip-deleteIcon')

      expect(deleteIcon).not.toBeNull()
      await user.click(deleteIcon as Element)

      expect(onRemove).toHaveBeenCalledTimes(1)
    })

    it('calls onClearAll when clear filters button is clicked', async () => {
      const user = userEvent.setup()
      const onClearAll = vi.fn()

      render(<FilterToolbar onClearAll={onClearAll} />, { wrapper })

      await user.click(
        screen.getByRole('button', { name: 'Clear Filters' })
      )

      expect(onClearAll).toHaveBeenCalledTimes(1)
    })

    it('does not call onClearAll when clear all is disabled', () => {
      const onClearAll = vi.fn()

      render(
        <FilterToolbar onClearAll={onClearAll} clearAllDisabled />,
        { wrapper }
      )

      expect(
        screen.getByRole('button', { name: 'Clear Filters' })
      ).toBeDisabled()
      expect(onClearAll).not.toHaveBeenCalled()
    })

    it('handles multiple select filters', () => {
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
        { wrapper }
      )

      expect(screen.getByText('Filter 1')).toBeInTheDocument()
      expect(screen.getByText('Filter 2')).toBeInTheDocument()
    })

    it('handles multiple pills', () => {
      render(
        <FilterToolbar
          pills={[
            { id: 'pill1', label: 'Filter 1', value: 'A', onRemove: vi.fn() },
            { id: 'pill2', label: 'Filter 2', value: 'B', onRemove: vi.fn() }
          ]}
        />,
        { wrapper }
      )

      expect(screen.getByText('Filter 1: A')).toBeInTheDocument()
      expect(screen.getByText('Filter 2: B')).toBeInTheDocument()
    })
  })

  describe('pill types and styling', () => {
    it('renders preset type pills', () => {
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
        { wrapper }
      )

      expect(screen.getByText('Preset: Value')).toBeInTheDocument()
    })

    it('renders select type pills', () => {
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
        { wrapper }
      )

      expect(screen.getByText('Select: Value')).toBeInTheDocument()
    })

    it('renders sort type pills with sort direction', () => {
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
        { wrapper }
      )

      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(
        container.querySelector('[data-testid="ArrowDropUpIcon"]')
      ).toBeInTheDocument()
    })

    it('renders sort pills with descending direction', () => {
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
        { wrapper }
      )

      expect(
        container.querySelector('[data-testid="ArrowDropDownIcon"]')
      ).toBeInTheDocument()
    })

    it('renders pill with custom renderContent', () => {
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
        { wrapper }
      )

      expect(screen.getByText('Custom: Value')).toBeInTheDocument()
    })
  })

  describe('select filter options', () => {
    it('handles filter with loading state', () => {
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
        { wrapper }
      )

      expect(screen.getByPlaceholderText('Loading...')).toBeInTheDocument()
    })

    it('handles disabled filter', () => {
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
        { wrapper }
      )

      expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
    })

    it('handles filter without label', () => {
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
        { wrapper }
      )

      expect(screen.getByPlaceholderText('No label')).toBeInTheDocument()
    })

    it('handles filter with custom width', () => {
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
        { wrapper }
      )

      expect(container.querySelector('.MuiAutocomplete-root')).toBeInTheDocument()
    })

    it('handles multiple select filter', () => {
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
        { wrapper }
      )

      expect(screen.getByPlaceholderText('Select multiple')).toBeInTheDocument()
    })
  })

  describe('showClearAll behavior', () => {
    it('shows clear all by default when onClearAll provided', () => {
      render(<FilterToolbar onClearAll={vi.fn()} />, { wrapper })

      expect(
        screen.getByRole('button', { name: 'Clear Filters' })
      ).toBeInTheDocument()
    })

    it('hides clear all when showClearAll is false', () => {
      render(
        <FilterToolbar onClearAll={vi.fn()} showClearAll={false} />,
        { wrapper }
      )

      expect(
        screen.queryByRole('button', { name: 'Clear Filters' })
      ).not.toBeInTheDocument()
    })

    it('does not render clear all when onClearAll not provided', () => {
      render(
        <FilterToolbar
          pills={[{ id: '1', label: 'Test', onRemove: vi.fn() }]}
        />,
        { wrapper }
      )

      expect(
        screen.queryByRole('button', { name: 'Clear Filters' })
      ).not.toBeInTheDocument()
    })
  })

  describe('custom styling', () => {
    it('accepts custom sx prop', () => {
      const { container } = render(
        <FilterToolbar
          pills={[{ id: '1', label: 'Test', onRemove: vi.fn() }]}
          sx={{ padding: 4 }}
        />,
        { wrapper }
      )

      expect(container.querySelector('.filter-toolbar')).toBeInTheDocument()
    })

    it('accepts sx as array', () => {
      const { container } = render(
        <FilterToolbar
          pills={[{ id: '1', label: 'Test', onRemove: vi.fn() }]}
          sx={[{ padding: 2 }, { margin: 1 }]}
        />,
        { wrapper }
      )

      expect(container.querySelector('.filter-toolbar')).toBeInTheDocument()
    })
  })
})
