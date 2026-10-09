import { useState, useCallback, useEffect, useRef } from 'react'
import IconButton from '@mui/material/IconButton'
import ClearIcon from '@mui/icons-material/Clear'
import type { ChangeEvent, MouseEvent } from 'react'

const ITEM_HEIGHT = 48
const ITEM_PADDING_TOP = 8

export interface BCSelectFloatingFilterProps {
  model?: { type?: string; filter?: string } | null
  onModelChange: (model: { type: string; filter: string } | null) => void
  optionsQuery: (params?: Record<string, unknown>) => {
    data?: Array<Record<string, unknown>>
    isLoading?: boolean
    isError?: boolean
    error?: Error
  }
  valueKey?: string
  labelKey?: string
  disabled?: boolean
  params?: Record<string, unknown>
  initialFilterType?: string
  multiple?: boolean
  initialSelectedValues?: string[]
}

type FilterOption = Record<string, unknown>

export const BCSelectFloatingFilter = ({
  model,
  onModelChange,
  optionsQuery,
  valueKey = 'value',
  labelKey = 'label',
  disabled = false,
  params,
  initialFilterType = 'equals',
  multiple = false,
  initialSelectedValues = []
}: BCSelectFloatingFilterProps) => {
  const [selectedValues, setSelectedValues] = useState<string[] | string>(
    multiple ? [] : ''
  )
  const [options, setOptions] = useState<FilterOption[]>([])
  const { data: optionsData, isLoading, isError, error } = optionsQuery(params)
  const optionsDataRef = useRef(optionsData)
  const optionsRef = useRef(options)
  const initialSelectedValuesRef = useRef(initialSelectedValues)
  const optionKeysRef = useRef({ valueKey, labelKey })

  useEffect(() => {
    optionsDataRef.current = optionsData
  }, [optionsData])

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    initialSelectedValuesRef.current = initialSelectedValues
  }, [initialSelectedValues])

  useEffect(() => {
    optionKeysRef.current = { valueKey, labelKey }
  }, [valueKey, labelKey])

  useEffect(() => {
    if (optionsDataRef.current) {
      setOptions(optionsDataRef.current)
    }
  }, [isLoading])

  useEffect(() => {
    if (!model) {
      setSelectedValues(initialSelectedValuesRef.current)
      return
    }

    const filterValues = model.filter?.split(',') || []
    const { valueKey: currentValueKey, labelKey: currentLabelKey } =
      optionKeysRef.current

    if (filterValues.length > 1) {
      const optionExists = optionsRef.current.some(
        (option) =>
          option[currentValueKey]?.toString() === model.filter?.toString()
      )

      if (!optionExists) {
        const newOptions: FilterOption[] = [
          {
            [currentValueKey]: model.filter,
            [currentLabelKey]: model.filter
          }
        ]
        setOptions((previous) => [...previous, ...newOptions])
      }
    }
    setSelectedValues(filterValues)
  }, [model])

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { options } = event.target
    const newValues = Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value)

    if (!multiple) {
      setSelectedValues([newValues[0] || ''])
      onModelChange(
        !newValues[0] || newValues[0] === '0'
          ? null
          : {
              type: initialFilterType,
              filter: newValues[0]
            }
      )
    } else {
      setSelectedValues(newValues)
      onModelChange({
        type: initialFilterType,
        filter: newValues.join(',')
      })
    }
  }

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setSelectedValues([])

    setOptions(optionsData || [])
    onModelChange(null)
  }

  const renderSelectContent = useCallback(() => {
    if (isLoading) {
      return (
        <option disabled value="">
          Loading...
        </option>
      )
    }

    if (isError) {
      return (
        <option disabled value="">
          Error loading options: {error?.message}
        </option>
      )
    }

    return options.map((option) => (
      <option key={option[valueKey]} value={option[valueKey]}>
        {option[labelKey]}
      </option>
    ))
  }, [isLoading, isError, options, error, valueKey, labelKey])

  return (
    <div
      style={{ position: 'relative', width: '100%' }}
      role="group"
      aria-labelledby="select-filter-label"
    >
      <div
        className="select-container"
        style={{
          maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP
        }}
        role="combobox"
        aria-expanded={selectedValues.length > 0}
        aria-controls="select-filter"
      >
        <select
          id="select-filter"
          multiple={multiple}
          value={selectedValues}
          onChange={handleChange}
          disabled={disabled || isLoading}
          aria-multiselectable={multiple}
          aria-disabled={disabled || isLoading}
          aria-describedby={
            isError ? 'select-filter-error' : 'select-filter-description'
          }
          style={{
            color: selectedValues.length > 0 ? '#999' : '#000'
          }}
        >
          <option
            value=""
            disabled={!multiple}
            style={{ display: multiple ? 'none' : 'block' }}
          >
            Select
          </option>
          {renderSelectContent()}
        </select>
        {selectedValues.length > 0 && (
          <IconButton
            size="small"
            sx={{ mr: 2 }}
            onClick={handleClear}
            onMouseDown={(event) => event.stopPropagation()}
            aria-label="Clear selection"
            tabIndex={-1}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </div>
    </div>
  )
}

BCSelectFloatingFilter.displayName = 'BCSelectFloatingFilter'
