import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RoleSelectFloatingFilter } from '../RoleSelectFloatingFilter'

vi.mock('@/components/BCDataGrid/components', () => ({
  BCSelectFloatingFilter: vi.fn(({ optionsQuery, valueKey, labelKey, model, onModelChange, disabled, params, initialFilterType, multiple, initialSelectedValues, customProp, onSelectionChange, clearable, ...domProps }) => {
    const result = optionsQuery?.()
    return (
      <div 
        data-test="bc-select-floating-filter" 
        {...domProps} 
        data-options-result={JSON.stringify(result)}
        data-value-key={valueKey}
        data-label-key={labelKey}
      />
    )
  })
}))

vi.mock('@/hooks/useRole', () => ({
  useRoleList: vi.fn()
}))

import { BCSelectFloatingFilter } from '@/components/BCDataGrid/components'
import { useRoleList } from '@/hooks/useRole'

const mockedBCSelectFloatingFilter = vi.mocked(BCSelectFloatingFilter)
const mockedUseRoleList = vi.mocked(useRoleList)

describe('RoleSelectFloatingFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders successfully with all props', () => {
      const mockData = [
        { id: 1, name: 'Admin', description: 'Administrator role' },
        { id: 2, name: 'User', description: 'Standard user role' }
      ]
      
      mockedUseRoleList.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      const props = {
        params: { page: 1, size: 10 },
        valueKey: 'id',
        labelKey: 'name',
        placeholder: 'Select Role',
        className: 'test-class'
      }

      render(<RoleSelectFloatingFilter {...props} />)

      expect(screen.getByTestId('bc-select-floating-filter')).toBeInTheDocument()
      expect(mockedUseRoleList).toHaveBeenCalledWith(props.params)
      expect(mockedBCSelectFloatingFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          valueKey: 'id',
          labelKey: 'name',
          placeholder: 'Select Role',
          className: 'test-class',
          optionsQuery: expect.any(Function)
        }),
        {}
      )
    })

    it('renders with minimal props', () => {
      mockedUseRoleList.mockReturnValue({
        data: [],
        isLoading: false
      })

      const props = {
        params: {},
        valueKey: 'id',
        labelKey: 'name'
      }

      render(<RoleSelectFloatingFilter {...props} />)

      expect(screen.getByTestId('bc-select-floating-filter')).toBeInTheDocument()
      expect(mockedUseRoleList).toHaveBeenCalledWith({})
    })
  })

  describe('Props Destructuring and Forwarding', () => {
    it('correctly destructures and passes props', () => {
      mockedUseRoleList.mockReturnValue({
        data: [],
        isLoading: false
      })

      const props = {
        params: { filter: 'active' },
        valueKey: 'id',
        labelKey: 'name',
        disabled: true,
        multiple: true,
        customProp: 'customValue'
      }

      render(<RoleSelectFloatingFilter {...props} />)

      expect(mockedBCSelectFloatingFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          valueKey: 'id',
          labelKey: 'name',
          disabled: true,
          multiple: true,
          customProp: 'customValue'
        }),
        {}
      )
    })

    it('handles spread operator for rest props', () => {
      mockedUseRoleList.mockReturnValue({
        data: [],
        isLoading: false
      })

      const extraProps = {
        onSelectionChange: vi.fn(),
        clearable: true,
        size: 'small'
      }

      const props = {
        params: {},
        valueKey: 'value',
        labelKey: 'label',
        ...extraProps
      }

      render(<RoleSelectFloatingFilter {...props} />)

      expect(mockedBCSelectFloatingFilter).toHaveBeenCalledWith(
        expect.objectContaining(extraProps),
        {}
      )
    })
  })

  describe('Hook Integration', () => {
    it('calls useRoleList with provided params', () => {
      const params = { 
        search: 'admin',
        status: 'active',
        page: 1,
        size: 20 
      }

      mockedUseRoleList.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(
        <RoleSelectFloatingFilter
          params={params}
          valueKey="id"
          labelKey="name"
        />
      )

      expect(mockedUseRoleList).toHaveBeenCalledWith(params)
      expect(mockedUseRoleList).toHaveBeenCalledTimes(1)
    })

    it('handles loading state from useRoleList', () => {
      mockedUseRoleList.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(
        <RoleSelectFloatingFilter
          params={{}}
          valueKey="id"
          labelKey="name"
        />
      )

      const component = screen.getByTestId('bc-select-floating-filter')
      const optionsResult = JSON.parse(component.getAttribute('data-options-result'))
      
      expect(optionsResult).toEqual({
        data: null,
        isLoading: true
      })
    })

    it('handles data state from useRoleList', () => {
      const mockRoles = [
        { id: 1, name: 'Administrator' },
        { id: 2, name: 'Manager' },
        { id: 3, name: 'Analyst' }
      ]

      mockedUseRoleList.mockReturnValue({
        data: mockRoles,
        isLoading: false
      })

      render(
        <RoleSelectFloatingFilter
          params={{}}
          valueKey="id"
          labelKey="name"
        />
      )

      const component = screen.getByTestId('bc-select-floating-filter')
      const optionsResult = JSON.parse(component.getAttribute('data-options-result'))
      
      expect(optionsResult).toEqual({
        data: mockRoles,
        isLoading: false
      })
    })

    it('handles empty data from useRoleList', () => {
      mockedUseRoleList.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(
        <RoleSelectFloatingFilter
          params={{}}
          valueKey="id"
          labelKey="name"
        />
      )

      const component = screen.getByTestId('bc-select-floating-filter')
      const optionsResult = JSON.parse(component.getAttribute('data-options-result'))
      
      expect(optionsResult).toEqual({
        data: [],
        isLoading: false
      })
    })
  })

  describe('optionsQuery Callback', () => {
    it('returns correct object structure from optionsQuery', () => {
      const mockData = [{ id: 1, name: 'Test Role' }]
      
      mockedUseRoleList.mockReturnValue({
        data: mockData,
        isLoading: false
      })

      render(
        <RoleSelectFloatingFilter
          params={{}}
          valueKey="id"
          labelKey="name"
        />
      )

      const [[callArgs]] = mockedBCSelectFloatingFilter.mock.calls
      const optionsQuery = callArgs.optionsQuery
      const result = optionsQuery()

      expect(result).toEqual({
        data: mockData,
        isLoading: false
      })
    })

    it('optionsQuery reflects current hook state', () => {
      mockedUseRoleList.mockReturnValue({
        data: null,
        isLoading: true
      })

      render(
        <RoleSelectFloatingFilter
          params={{}}
          valueKey="id"
          labelKey="name"
        />
      )

      const [[callArgs]] = mockedBCSelectFloatingFilter.mock.calls
      const optionsQuery = callArgs.optionsQuery
      const result = optionsQuery()

      expect(result.data).toBeNull()
      expect(result.isLoading).toBe(true)
    })

    it('optionsQuery is a function', () => {
      mockedUseRoleList.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(
        <RoleSelectFloatingFilter
          params={{}}
          valueKey="id"
          labelKey="name"
        />
      )

      const [[callArgs]] = mockedBCSelectFloatingFilter.mock.calls
      expect(typeof callArgs.optionsQuery).toBe('function')
    })
  })

  describe('Edge Cases', () => {
    it('handles undefined params', () => {
      mockedUseRoleList.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(
        <RoleSelectFloatingFilter
          params={undefined}
          valueKey="id"
          labelKey="name"
        />
      )

      expect(mockedUseRoleList).toHaveBeenCalledWith(undefined)
      expect(screen.getByTestId('bc-select-floating-filter')).toBeInTheDocument()
    })

    it('handles null valueKey and labelKey', () => {
      mockedUseRoleList.mockReturnValue({
        data: [],
        isLoading: false
      })

      render(
        <RoleSelectFloatingFilter
          params={{}}
          valueKey={null}
          labelKey={null}
        />
      )

      expect(mockedBCSelectFloatingFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          valueKey: null,
          labelKey: null
        }),
        {}
      )
    })

    it('handles missing optional props', () => {
      mockedUseRoleList.mockReturnValue({
        data: [],
        isLoading: false
      })

      const minimalProps = {
        valueKey: 'id',
        labelKey: 'name'
      }

      render(<RoleSelectFloatingFilter {...minimalProps} />)

      expect(mockedUseRoleList).toHaveBeenCalledWith(undefined)
      expect(screen.getByTestId('bc-select-floating-filter')).toBeInTheDocument()
    })
  })
})