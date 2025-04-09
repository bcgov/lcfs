import React, {
  forwardRef,
  useState,
  useEffect,
  useRef,
  useImperativeHandle
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

  // Fix initial value parsing
  const parseInitialValue = (initialValue) => {
    if (!initialValue) return multiple ? [] : null
    if (Array.isArray(initialValue)) return initialValue
    if (typeof initialValue === 'string') {
      const values = initialValue.split(',').map((v) => v.trim())
      return multiple ? values : values[0]
    }
    return multiple ? [initialValue] : initialValue
  }

  const [selectedValues, setSelectedValues] = useState(() =>
    parseInitialValue(value)
  )
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
    const processedValue = multiple ? newValue : newValue || ''
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
      onValueChange(selectedValues)
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
    if (!option || !value) return false

    if (typeof option === 'string' && typeof value === 'string') {
      return option === value
    }

    if (typeof option === 'object' && typeof value === 'object') {
      return option.label === value.label
    }

    if (typeof option === 'object' && typeof value === 'string') {
      return option.label === value
    }

    if (typeof option === 'string' && typeof value === 'object') {
      return option === value.label
    }

    return false
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
        value={selectedValues}
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
