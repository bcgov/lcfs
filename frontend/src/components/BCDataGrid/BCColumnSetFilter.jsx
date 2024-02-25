import { forwardRef, useImperativeHandle, useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Autocomplete, TextField, Box, Checkbox } from '@mui/material'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />
const checkedIcon = <CheckBoxIcon fontSize="small" />

const BCColumnSetFilter = (props) => {
  const { apiQuery, params, key } = props
  const { columnWidth } = props.column.colDef
  const [options, setOptions] = useState([])
  const [currentValue, setCurrentValue] = useState(null)
  // make api call to retrieve list
  const { data: optionsData, isLoading: optionsIsLoading } = apiQuery(params)

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
        instance.onFloatingFilterChanged('equals', val)
      } else {
        const filterArr = input.map((item) => item.name).join(', ')
        setCurrentValue(filterArr)
        instance.onFloatingFilterChanged('equals', filterArr)
      }
    })
  }

  useEffect(() => {
    // if no data then wait for re-load
    if (!optionsData || params !== props.params) return
    // if already loaded then disable re-load
    if (options === optionsData) return
    const optionsDataCopy = optionsData.map((option) => ({
      name: option[props.apiOptionField ? props.apiOptionField : 'name']
    }))

    setOptions(optionsDataCopy)
  }, [optionsData])

  return (
    <Autocomplete
      key={key}
      multiple={props.multiple}
      disableCloseOnSelect={props.disableCloseOnSelect}
      onChange={onInputBoxChanged}
      isOptionEqualToValue={(option, value) => option.name === value.name}
      limitTags={1}
      id="bc-column-set-filter"
      className="ag-list ag-select-list ag-ltr ag-popup-child ag-popup-positioned-under"
      role="list-box"
      sx={{ width: columnWidth }}
      options={options}
      loading={optionsIsLoading}
      autoHighlight
      size="small"
      getOptionLabel={(option) => option.name}
      renderOption={(propsIn, option, { selected }) => (
        <Box
          component="li"
          key={option}
          className={
            selected
              ? 'ag-list-item ag-select-list-item selected'
              : 'ag-list-item ag-select-list-item'
          }
          role="option"
          sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
          {...propsIn}
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
}

BCColumnSetFilter.defaultProps = {
  // apiQuery: () => ({ data: [], isLoading: false }),
  apiOptionField: 'name',
  multiple: false,
  disableCloseOnSelect: false,
  key: 'my-ag-grid-column-filter-key'
}

BCColumnSetFilter.propTypes = {
  apiQuery: PropTypes.func.isRequired, // react query or a fetch query which will return data, isLoading and Error fields.
  // for static data, use the following format:
  // apiQuery: () => ({ data: [ { name: 'Option 1' }, { name: 'Option 2' } ], isLoading: false, isError: false }
  apiOptionField: PropTypes.string.isRequired, // field name of the option in the data object. For above static data 'name' is the option field
  column: PropTypes.object.isRequired, // AG Grid column object. not required to pass explicitly
  parentFilterInstance: PropTypes.func.isRequired, // AG Grid Filter Lifecycle callback. not required to pass explicitly
  multiple: PropTypes.bool, // ability to select multiple options.
  params: PropTypes.any, // any parameters that needs to be passed to apiQuery (React Query).
  key: PropTypes.string, // unique key to re-render filter component
  disableCloseOnSelect: PropTypes.bool
}

export default BCColumnSetFilter
