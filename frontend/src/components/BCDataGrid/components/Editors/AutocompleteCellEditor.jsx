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
    onPaste
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
    // Options can be primitives or { value, label }
    return options.find((opt) => {
      if (typeof opt === 'object') {
        return opt?.value === raw
      }
      return opt === raw
    })
  }

  // Store editor state as RAW values; map to option objects for Autocomplete's value prop
  const [selectedValues, setSelectedValues] = useState(() => {
    if (multiple) {
      if (Array.isArray(value)) return value
      if (value == null || value === '') return []
      if (typeof value === 'string') {
        return value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v !== '')
      }
      return [value]
    }
    if (value == null) return ''
    if (typeof value === 'string') {
      const first = value.split(',')[0]?.trim() ?? ''
      return first
    }
    return value
  })

  const selectedOptions = useMemo(() => {
    if (multiple) {
      return Array.isArray(selectedValues)
        ? selectedValues.map((rv) => findOptionByRaw(rv)).filter(Boolean)
        : []
    }
    return findOptionByRaw(selectedValues)
  }, [multiple, selectedValues, options])
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef()

  useImperativeHandle(ref, () => ({
    getValue: () => {
      if (multiple) {
        return Array.isArray(selectedValues) ? selectedValues : []
      }
      return selectedValues || ''
    },
    isCancelBeforeStart: () => false,
    isCancelAfterEnd: () => false,
    afterGuiAttached: () => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }))

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleChange = (event, newValue) => {
    const processedValue = multiple
      ? getRawValue(newValue)
      : getRawValue(newValue)
    setSelectedValues(processedValue)
    if (onValueChange) {
      onValueChange(processedValue)
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
    if (onKeyDownCapture) {
      onKeyDownCapture(event)
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      setIsOpen(!isOpen)
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      if (onValueChange) onValueChange(selectedValues)
      api.stopEditing()

      if (event.shiftKey) {
        api.tabToPreviousCell()
        setTimeout(navigateToNextCell, 0)
      } else {
        api.tabToNextCell()
        setTimeout(navigateToNextCell, 0)
      }
    }
  }

  const handleBlur = (event) => {
    if (onBlur) {
      onBlur(event)
    }
    api.stopEditing()
  }

  const isOptionEqualToValue = (option, value) => {
    // Compare using underlying raw values when possible
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
        value={selectedOptions}
        onInputChange={freeSolo ? handleChange : null}
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
          const isOptionSelected = multiple
            ? Array.isArray(selectedValues) &&
              selectedValues.some((val) => isOptionEqualToValue(val, option))
            : isOptionEqualToValue(selectedValues, option)

          return (
            <React.Fragment
              key={typeof option === 'string' ? option : option.label}
            >
              <Box
                component="li"
                className={`${
                  selected || isOptionSelected ? 'selected' : ''
                } ag-custom-component-popup`}
                role="option"
                sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
                aria-label={`select ${
                  typeof option === 'string' ? option : option.label
                }`}
                data-testid={`select-${
                  typeof option === 'string' ? option : option.label
                }`}
                {...props}
                tabIndex={0}
              >
                {multiple && (
                  <Checkbox
                    color="primary"
                    role="presentation"
                    sx={{ border: '2px solid primary' }}
                    icon={icon}
                    checkedIcon={checkedIcon}
                    style={{ marginRight: 8 }}
                    checked={selected || isOptionSelected}
                    inputProps={{ 'aria-label': 'controlled' }}
                    tabIndex={-1}
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
            inputProps={{
              ...params.inputProps,
              autoComplete: 'off'
            }}
          />
        )}
        renderTags={(value, getTagProps) => (
          <Stack direction="row" spacing={1}>
            {value.slice(0, limitTags).map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={typeof option === 'string' ? option : option.label}
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
