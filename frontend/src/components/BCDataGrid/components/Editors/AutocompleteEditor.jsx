import BCBox from '@/components/BCBox'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import {
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  Stack,
  TextField
} from '@mui/material'
import PropTypes from 'prop-types'
import { useState } from 'react'

const icon = <CheckBoxOutlineBlankIcon fontSize="medium" />
const checkedIcon = <CheckBoxIcon fontSize="medium" />

export const AutocompleteEditor = (props) => {
  const {
    value='',
    options = [],
    onValueChange,
    limitTags = 2,
    multiple = false,
    disableCloseOnSelect = false,
    openOnFocus = true,
    onDynamicUpdate,
    onKeyDownCapture,
    onBlur,
    onPaste,
    freeSolo = false,
    autoSelect,
    colDef
  } = props

  const [selectedValues, setSelectedValues] = useState(value || [])

  const updateValue = (val) => {
    setSelectedValues(val)
    onValueChange(val)
    if (onDynamicUpdate) {
      onDynamicUpdate(val, props)
    }
  }

  const handleBlur = (e) => {
    if (freeSolo && e.target.value) {
      const newValue = e.target.value;
      updateValue(newValue);
    }

    if (onBlur) {
      onBlur(e, updateValue)
    }
  }

  const handleKeyDown = (event) => {
    if (onKeyDownCapture) {
      onKeyDownCapture(event)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      props.api.tabToNextCell()
    }
  }

  return (
    <BCBox
      component="div"
      aria-label="Select options from the drop down"
      data-testid="ag-grid-editor-select-options"
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
        onChange={(_, newValue) => updateValue(newValue)}
        multiple={multiple}
        disableCloseOnSelect={disableCloseOnSelect}
        limitTags={limitTags}
        // id="bc-column-set-filter"
        className="bc-column-set-filter ag-input-field ag-checkbox-input"
        role="list-box"
        options={options}
        // isOptionEqualToValue={(option, value) => option === value}
        onKeyDownCapture={handleKeyDown}
        onBlur={handleBlur}
        onPaste={(e) => onPaste(e, updateValue)}
        autoHighlight
        size="medium"
        freeSolo={freeSolo}
        autoSelect={autoSelect}
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
            className="ag-input-field ag-checkbox-input"
            role="presentation"
            {...params}
            label={
              colDef?.cellEditorParams?.noLabel
                ? null
                : colDef?.cellEditorParams?.label || 'Select'
            }
            variant="outlined"
            size="medium"
            inputProps={{
              ...params.inputProps,
              autoComplete: 'new-password', // disable autocomplete and autofill
              tabIndex: 0
            }}
          />
        )}
        renderTags={(value, getTagProps) => {
          const numTags = value.length

          return (
            <Stack direction="row" spacing={1}>
              {value
                .slice(0, limitTags)
                .map(
                  (option, index) =>
                    index < limitTags && (
                      <Chip
                        component="span"
                        {...getTagProps({ index })}
                        key={typeof option === 'string' ? option : option.label}
                        label={
                          typeof option === 'string' ? option : option.label
                        }
                      />
                    )
                )}
              {numTags > limitTags && (
                <Chip label={` +${numTags - limitTags}`} size="small" />
              )}
            </Stack>
          )
        }}
      />
    </BCBox>
  )
}

AutocompleteEditor.propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  onValueChange: PropTypes.func.isRequired,
  eventKey: PropTypes.string,
  rowIndex: PropTypes.number,
  column: PropTypes.object,
  openOnFocus: PropTypes.bool,
  multiple: PropTypes.bool,
  disableCloseOnSelect: PropTypes.bool,
  selectedValues: PropTypes.array,
  options: PropTypes.array.isRequired,
  freeSolo: PropTypes.bool,
  onBlur: PropTypes.func
}

AutocompleteEditor.displayName = 'AutocompleteEditor'
