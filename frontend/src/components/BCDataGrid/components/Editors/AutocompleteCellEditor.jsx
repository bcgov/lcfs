/* eslint-disable react-refresh/only-export-components */
import { useGridCellEditor } from 'ag-grid-react'
import { memo, useEffect, useRef, useState, useCallback } from 'react'
import {
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  Stack,
  TextField
} from '@mui/material'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import BCBox from '@/components/BCBox'

const icon = <CheckBoxOutlineBlankIcon fontSize="medium" />
const checkedIcon = <CheckBoxIcon fontSize="medium" />

// eslint-disable-next-line react/display-name
export default memo(
  ({ value, onValueChange, eventKey, cellStartedEdit, ...props }) => {
    const limitTags = props.limitTags || 2
    const [selectedValues, setSelectedValues] = useState(value || [])
    const refInput = useRef(null)

    const updateValue = useCallback(
      (val) => {
        setSelectedValues(val)
        onValueChange(val)
      },
      [onValueChange]
    )

    useEffect(() => {
      updateValue(eventKey)
      if (cellStartedEdit && refInput) {
        refInput?.current?.focus()
        refInput?.current?.select()
      }
    }, [cellStartedEdit, eventKey, updateValue])

    // when we tab into this editor, we want to focus the contents
    const focusIn = useCallback(() => {
      refInput.current.focus()
      refInput.current.select()
      console.log('NumericCellEditor.focusIn()')
    }, [])

    // when we tab out of the editor, this gets called
    const focusOut = useCallback(() => {
      console.log('NumericCellEditor.focusOut()')
    }, [])

    useGridCellEditor({
      focusIn,
      focusOut
    })

    return (
      <BCBox
        component="div"
        aria-label="Select options from the drop down"
        data-testid="ag-grid-editor-select-options"
        sx={{
          '& .MuiAutocomplete-inputRoot': {
            paddingBottom: '8px',
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
          openOnFocus={props.openOnFocus}
          value={selectedValues}
          onChange={(_, newValue) => updateValue(newValue)}
          multiple={props.multiple}
          disableCloseOnSelect={props.disableCloseOnSelect}
          limitTags={limitTags}
          id="bc-column-set-filter"
          className="bc-column-set-filter ag-input-field ag-checkbox-input"
          role="list-box"
          options={props.options}
          isOptionEqualToValue={(option, value) => option === value}
          autoHighlight
          size="medium"
          freeSolo={props.freeSolo}
          autoSelect={props.autoSelect}
          getOptionLabel={(option) =>
            typeof option === 'string' ? option : option.label || ''
          }
          renderOption={(propsIn, option, { selected }) => {
            const isOptionSelected =
              Array.isArray(selectedValues) && selectedValues.includes(option)
            return (
              <Box
                component="li"
                key={typeof option === 'string' ? option : option.label}
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
                {props.multiple && (
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
              inputRef={refInput}
              {...params}
              label={
                props.colDef?.cellEditorParams?.noLabel
                  ? null
                  : props.colDef?.cellEditorParams?.label || 'Select'
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
                          key={
                            typeof option === 'string' ? option : option.label
                          }
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
)
