import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import PropTypes from 'prop-types'
import { Autocomplete, TextField, Box, Checkbox } from '@mui/material'
import { CheckBox, CheckBoxOutlineBlank } from '@mui/icons-material'

const icon = <CheckBoxOutlineBlank fontSize="small" />
const checkedIcon = <CheckBox fontSize="small" />
/**
 * @deprecated
 */
export const BCColumnSetFilter = forwardRef((props, ref) => {
  const { apiQuery, params } = props
  const [options, setOptions] = useState([])
  const [currentValue, setCurrentValue] = useState(null)
  // make api call to retrieve list
  const { data: optionsData, isLoading: optionsIsLoading } = apiQuery(params)

  // expose AG Grid Filter Lifecycle callbacks
  useImperativeHandle(ref, () => {
    return {
      onParentModelChanged(parentModel) {
        // When the filter is empty we will receive a null value here
        if (!parentModel) {
          setCurrentValue(null)
        } else {
          setCurrentValue(parentModel.filter + '')
        }
      }
    }
  })
  const onInputBoxChanged = (event, input) => {
    if (event.target.value === '') {
      // Remove the filter
      props.parentFilterInstance((instance) => {
        instance.onFloatingFilterChanged(null, null)
      })
      return
    }

    props.parentFilterInstance((instance) => {
      if (!props.multiple) {
        const val = input ? input.name : ''
        setCurrentValue(val)
        instance.onFloatingFilterChanged('custom', val)
      } else {
        const filterArr = input.map((item) => item.name).join(', ')
        setCurrentValue(filterArr)
        instance.onFloatingFilterChanged('custom', filterArr)
      }
    })
  }

  useEffect(() => {
    // if no data then wait for re-load
    if (!optionsData) return
    // if already loaded then disable re-load
    if (options === optionsData) return
    const optionsDataCopy = optionsData.map((option) => ({
      name: option[props.apiOptionField ? props.apiOptionField : 'name']
    }))

    setOptions(optionsDataCopy)
  }, [optionsData])

  return (
    <Autocomplete
      multiple={props.multiple}
      disableCloseOnSelect={props.disableCloseOnSelect}
      onChange={onInputBoxChanged}
      openOnFocus
      isOptionEqualToValue={(option, value) => option.name === value.name}
      limitTags={1}
      className="bc-column-set-filter ag-list ag-select-list ag-ltr ag-popup-child ag-popup-positioned-under"
      role="list-box"
      sx={{
        width: '100%',
        '.MuiInputBase-root': {
          borderRadius: 'inherit'
        }
      }}
      options={options}
      loading={optionsIsLoading}
      autoHighlight
      size="small"
      getOptionLabel={(option) => option.name}
      renderOption={(propsIn, option, { selected }) => (
        <Box
          component="li"
          className={
            selected
              ? 'ag-list-item ag-select-list-item selected'
              : 'ag-list-item ag-select-list-item'
          }
          role="option"
          sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
          {...propsIn}
          key={option.name}
        >
          {props.multiple && (
            <Checkbox
              color="primary"
              className="ag-set-filter-item-checkbox ag-labeled ag-label-align-right ag-checkbox ag-input-field"
              role="presentation"
              sx={{ border: '2px solid primary' }}
              icon={icon}
              checkedIcon={checkedIcon}
              style={{ marginRight: 8 }}
              checked={selected}
            />
          )}
          {option.name}
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          className="ag-text-field ag-input-field auto-select-filter"
          role="presentation"
          {...params}
          label="Select"
          value={currentValue}
          variant="outlined"
          size="small"
          inputProps={{
            ...params.inputProps,
            autoComplete: 'new-password' // disable autocomplete and autofill
          }}
        />
      )}
    />
  )
})

BCColumnSetFilter.displayName = 'BCColumnSetFilter'

BCColumnSetFilter.propTypes = {
  apiQuery: PropTypes.func.isRequired, // react query or a fetch query which will return data, isLoading and Error fields.
  // for static data, use the following format:
  // apiQuery: () => ({ data: [ { name: 'Option 1' }, { name: 'Option 2' } ], isLoading: false, isError: false }
  apiOptionField: PropTypes.string.isRequired, // field name of the option in the data object. For above static data 'name' is the option field
  column: PropTypes.object.isRequired, // AG Grid column object. not required to pass explicitly
  parentFilterInstance: PropTypes.func.isRequired, // AG Grid Filter Lifecycle callback. not required to pass explicitly
  multiple: PropTypes.bool, // ability to select multiple options.
  params: PropTypes.any, // any parameters that needs to be passed to apiQuery (React Query).
  disableCloseOnSelect: PropTypes.bool
}
