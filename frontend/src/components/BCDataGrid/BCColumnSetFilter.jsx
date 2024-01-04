import {
  forwardRef,
  useRef,
  useImperativeHandle,
  useState,
  useEffect
} from 'react'
import { Autocomplete, TextField, Box, Checkbox } from '@mui/material'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CheckBoxIcon from '@mui/icons-material/CheckBox'

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />
const checkedIcon = <CheckBoxIcon fontSize="small" />

const BCColumnSetFilter = forwardRef((props, ref) => {
  const { columnWidth } = props.column.colDef
  const [options, setOptions] = useState([])
  const { data: optionsData, isLoading: optionsIsLoading } = props.apiQuery()

  const [currentValue, setCurrentValue] = useState(null)
  const inputRef = useRef(null)

  // expose AG Grid Filter Lifecycle callbacks
  useImperativeHandle(ref, () => {
    return {
      onParentModelChanged(parentModel) {
        // When the filter is empty we will receive a null value here
        if (!parentModel) {
          inputRef.current.value = ''
          setCurrentValue(null)
        } else {
          inputRef.current.value = parentModel.filter + ''
          setCurrentValue(parentModel.filter)
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
        instance.onFloatingFilterChanged('equals', val)
      } else {
        const filterArr = input.map((item) => item.name).join(', ')
        setCurrentValue(filterArr)
        instance.onFloatingFilterChanged('equals', filterArr)
      }
    })
  }

  useEffect(() => {
    if (!optionsData) return
    const optionsDataCopy = optionsData.map((option) => ({
      name: option[props.apiOptionField ? props.apiOptionField : 'name']
    }))
    // if already loaded then disable re-load
    if (options.length > 0) return
    setOptions(optionsDataCopy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsData, props.apiOptionField])

  return (
    <Autocomplete
      ref={inputRef}
      multiple={props.multiple}
      disableCloseOnSelect={props.disableCloseOnSelect}
      onChange={onInputBoxChanged}
      isOptionEqualToValue={(option, value) => option.name === value.name}
      limitTags={1}
      id="bc-column-set-filter"
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
          className={selected ? 'selected' : ''}
          sx={{ '& > img': { mr: 2, flexShrink: 0 } }}
          {...propsIn}
        >
          {props.multiple && (
            <Checkbox
              color="primary"
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
          {...params}
          label=""
          value={currentValue}
          variant="outlined"
          className="auto-select-filter"
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
export default BCColumnSetFilter
