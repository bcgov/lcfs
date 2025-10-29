import React, {
  forwardRef,
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  useMemo
} from 'react'
import PropTypes from 'prop-types'
import {
  Autocomplete,
  TextField,
  Checkbox,
  Box,
  Chip,
  Stack,
  Divider
} from '@mui/material'
import { CheckBox, CheckBoxOutlineBlank } from '@mui/icons-material'

const icon = <CheckBoxOutlineBlank fontSize="medium" />
const checkedIcon = <CheckBox fontSize="medium" />

export const AutocompleteCellEditor = forwardRef((props, ref) => {
  const {
    value = '',
    options = [],
    limitTags = 2,
    multiple = false,
    disableCloseOnSelect = false,
    openOnFocus = true,
    freeSolo = false,
    colDef,
    api,
    onValueChange,
    onKeyDownCapture,
    onBlur,
    onPaste,
    returnObject = false // NEW: when false, emit IDs; when true, emit option objects
  } = props

  // Helpers to map between raw values (ids/strings) and option objects
  const getRawValue = (optionOrValue) => {
    if (optionOrValue == null) return null
    if (typeof optionOrValue === 'object') {
      // Expect shape { value, label }
      return Object.prototype.hasOwnProperty.call(optionOrValue, 'value')
        ? optionOrValue.value
        : optionOrValue
    }
    return optionOrValue
  }

  const findOptionByRaw = (raw) => {
    if (raw == null) return null
    return options.find((opt) =>
      typeof opt === 'object' ? opt?.value === raw : opt === raw
    )
  }

  const initSelected = () => {
    if (multiple) {
      if (Array.isArray(value)) {
        // `value` could be an array of objects or ids/strings
        return value
          .map((v) => (typeof v === 'object' ? v : findOptionByRaw(v)))
          .filter(Boolean)
      }
      if (value == null || value === '') return []
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((v) => v.trim())
          .map((rv) => findOptionByRaw(rv))
          .filter(Boolean)
      }
      // single primitive
      return [findOptionByRaw(value)].filter(Boolean)
    }
    // single mode
    if (value == null || value === '') return null
    if (typeof value === 'object') return value
    if (typeof value === 'string') {
      const first = value.split(',')[0]?.trim()
      return findOptionByRaw(first)
    }
    return findOptionByRaw(value)
  }
  const [selected, setSelected] = useState(initSelected)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    getValue: () => {
      if (multiple) {
        if (returnObject) return Array.isArray(selected) ? selected : []
        return Array.isArray(selected)
          ? selected.map((opt) => getRawValue(opt))
          : []
      }
      if (returnObject) return selected || null
      return selected ? getRawValue(selected) : ''
    },
    isCancelBeforeStart: () => false,
    isCancelAfterEnd: () => false,
    afterGuiAttached: () => inputRef.current?.focus()
  }))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleChange = (event, newValue) => {
    // newValue is an option object (single) or array of option objects (multiple)
    setSelected(newValue)
    if (onValueChange) {
      if (multiple) {
        onValueChange(
          returnObject
            ? newValue
            : Array.isArray(newValue)
              ? newValue.map((o) => getRawValue(o))
              : []
        )
      } else {
        onValueChange(returnObject ? newValue : getRawValue(newValue))
      }
    }
  }

  const navigateToNextCell = () => {
    const focusedCell = api.getFocusedCell()
    if (focusedCell) {
      api.startEditingCell({
        rowIndex: focusedCell.rowIndex,
        colKey: focusedCell.column.getId()
      })
    }
  }

  const handleKeyDown = (event) => {
    onKeyDownCapture?.(event)
    if (event.key === 'Enter') {
      event.preventDefault()
      setIsOpen((o) => !o)
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      onValueChange?.(
        multiple
          ? returnObject
            ? selected || []
            : (selected || []).map((o) => getRawValue(o))
          : returnObject
            ? selected
            : selected
              ? getRawValue(selected)
              : ''
      )
      api.stopEditing()
      if (event.shiftKey) {
        api.tabToPreviousCell()
        setTimeout(() => {
          const focusedCell = api.getFocusedCell()
          if (focusedCell) {
            api.startEditingCell({
              rowIndex: focusedCell.rowIndex,
              colKey: focusedCell.column.getId()
            })
          }
        }, 0)
      } else {
        api.tabToNextCell()
        setTimeout(() => {
          const focusedCell = api.getFocusedCell()
          if (focusedCell) {
            api.startEditingCell({
              rowIndex: focusedCell.rowIndex,
              colKey: focusedCell.column.getId()
            })
          }
        }, 0)
      }
    }
  }

  const handleBlur = (event) => {
    onBlur?.(event)
    api.stopEditing()
  }

  const isOptionEqualToValue = (option, value) => {
    // Compare by underlying id/value
    const optRaw = getRawValue(option)
    const valRaw = getRawValue(value)
    return optRaw === valRaw
  }

  return (
    <Box
      component="div"
      aria-label="Select options from the drop down"
      sx={{
        '& .MuiAutocomplete-inputRoot': {
          paddingBottom: '4px',
          backgroundColor: '#fff'
        }
      }}
    >
      <Autocomplete
        sx={{
          '.MuiOutlinedInput-root': {
            padding: '2px 0px 2px 0px'
          }
        }}
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        openOnFocus={openOnFocus}
        value={selected}
        onChange={handleChange}
        multiple={multiple}
        disableCloseOnSelect={disableCloseOnSelect}
        limitTags={limitTags}
        options={options}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        autoHighlight
        size="medium"
        freeSolo={freeSolo}
        isOptionEqualToValue={isOptionEqualToValue}
        getOptionLabel={(option) => {
          if (!option) return ''
          return typeof option === 'string' ? option : option.label || ''
        }}
        renderOption={(props, option, { selected }) => {
          const isSelected = multiple
            ? Array.isArray(selected) && selected.some(Boolean)
            : selected
          return (
            <React.Fragment
              key={
                typeof option === 'string'
                  ? option
                  : (option.value ?? option.label)
              }
            >
              <Box
                component="li"
                className={`${selected || isSelected ? 'selected' : ''} ag-custom-component-popup`}
                role="option"
                sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
                aria-label={`select ${typeof option === 'string' ? option : option.label}`}
                data-testid={`select-${typeof option === 'string' ? option : option.label}`}
                {...props}
                tabIndex={0}
              >
                {multiple && (
                  <Checkbox
                    color="primary"
                    icon={icon}
                    checkedIcon={checkedIcon}
                    style={{ marginRight: 8 }}
                    checked={selected || isSelected}
                    tabIndex={-1}
                    inputProps={{ 'aria-label': 'controlled' }}
                  />
                )}
                {typeof option === 'string' ? option : option.label}
              </Box>
              <Divider />
            </React.Fragment>
          )
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={
              colDef?.cellEditorParams?.noLabel
                ? null
                : colDef?.cellEditorParams?.label || 'Select'
            }
            variant="outlined"
            size="medium"
            inputRef={inputRef}
            onBlur={handleBlur}
            inputProps={{ ...params.inputProps, autoComplete: 'off' }}
          />
        )}
        renderTags={(value, getTagProps) => (
          <Stack direction="row" spacing={1}>
            {value.slice(0, limitTags).map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={
                  typeof option === 'string'
                    ? option
                    : (option.value ?? option.label)
                }
                label={typeof option === 'string' ? option : option.label}
              />
            ))}
            {value.length > limitTags && (
              <Chip label={`+${value.length - limitTags}`} size="small" />
            )}
          </Stack>
        )}
      />
    </Box>
  )
})

AutocompleteCellEditor.propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  options: PropTypes.array.isRequired,
  limitTags: PropTypes.number,
  multiple: PropTypes.bool,
  disableCloseOnSelect: PropTypes.bool,
  openOnFocus: PropTypes.bool,
  freeSolo: PropTypes.bool,
  colDef: PropTypes.object,
  api: PropTypes.object.isRequired,
  column: PropTypes.object.isRequired,
  node: PropTypes.object.isRequired,
  onKeyDownCapture: PropTypes.func,
  onBlur: PropTypes.func,
  onPaste: PropTypes.func
}

AutocompleteCellEditor.displayName = 'AutocompleteEditor'
