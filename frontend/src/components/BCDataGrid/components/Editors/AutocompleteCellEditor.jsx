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
  Stack
} from '@mui/material'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'

const icon = <CheckBoxOutlineBlankIcon fontSize="medium" />
const checkedIcon = <CheckBoxIcon fontSize="medium" />

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

  const [selectedValues, setSelectedValues] = useState(
    (Array.isArray(value) ? value : value.split(',').map((v) => v.trim())) || []
  )
  const inputRef = useRef()

  useImperativeHandle(ref, () => ({
    getValue: () => selectedValues,
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
    setSelectedValues(newValue)
    onValueChange(newValue)
  }

  const handleKeyDown = (event) => {
    if (onKeyDownCapture) {
      onKeyDownCapture(event)
    } else if (event.key === 'Tab') {
      onValueChange(selectedValues)
      event.preventDefault()
      api.stopEditing()

      const navigateToNextCell = () => {
        const focusedCell = api.getFocusedCell()
        if (focusedCell) {
          api.startEditingCell({
            rowIndex: focusedCell.rowIndex,
            colKey: focusedCell.column.getId(),
          })
        }
      }

      if (event.shiftKey) {
        // Shift + Tab: Move to the previous cell
        api.tabToPreviousCell()
        setTimeout(navigateToNextCell, 0) // Ensure editing starts after navigation
      } else {
        // Tab: Move to the next cell
        api.tabToNextCell()
        setTimeout(navigateToNextCell, 0) // Ensure editing starts after navigation
      }
    }
  }


  const handleBlur = (event) => {
    if (onBlur) {
      onBlur(event)
    }
    api.stopEditing()
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
        getOptionLabel={(option) =>
          typeof option === 'string' ? option : option.label || ''
        }
        renderOption={({ key, ...propsIn }, option, { selected }) => {
          const isOptionSelected =
            Array.isArray(selectedValues) && selectedValues.includes(option)
          return (
            <Box
              component="li"
              key={key}
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
              {...propsIn}
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
              autoComplete: 'off' // disable autocomplete and autofill
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
