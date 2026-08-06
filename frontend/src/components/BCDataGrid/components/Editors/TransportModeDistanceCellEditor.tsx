// @ts-nocheck
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import PropTypes from 'prop-types'
import {
  Box,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Stack,
  TextField,
  Typography
} from '@mui/material'

const getOptionLabel = (option) => {
  if (option == null) return ''
  if (typeof option === 'string' || typeof option === 'number') {
    return option.toString()
  }
  return (
    option.label || option.name || option.transportMode || option.value || ''
  )
}

const getModeName = (value) => {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number')
    return value.toString()
  return (
    value.transportMode ||
    value.mode ||
    value.label ||
    value.name ||
    value.value ||
    ''
  )
}

const getDistance = (value, fallbackDistance = '') => {
  if (value && typeof value === 'object') {
    return value.distance ?? value.transportDistance ?? fallbackDistance ?? ''
  }
  return fallbackDistance ?? ''
}

const normalizeValue = (value, fallbackDistance = '') => {
  if (!value && value !== 0) return []
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',').map((v) => v.trim())
      : [value]

  return values
    .map((item) => ({
      transportMode: getModeName(item),
      distance: getDistance(item, fallbackDistance)
    }))
    .filter((item) => item.transportMode)
}

export const TransportModeDistanceCellEditor = forwardRef((props, ref) => {
  const { value, options = [], api, data, colDef, onValueChange } = props
  const fallbackDistance = data?.[colDef?.cellEditorParams?.distanceField]
  const normalizedOptions = useMemo(
    () => options.map((option) => getOptionLabel(option)).filter(Boolean),
    [options]
  )
  const [selectedModes, setSelectedModes] = useState(() =>
    normalizeValue(value, fallbackDistance)
  )
  const firstInputRef = useRef(null)

  const getCurrentValue = () =>
    selectedModes.map((item) => ({
      transportMode: item.transportMode,
      distance:
        item.distance === '' ||
        item.distance === null ||
        item.distance === undefined
          ? ''
          : Number(item.distance)
    }))

  useImperativeHandle(ref, () => ({
    getValue: () => getCurrentValue(),
    isCancelBeforeStart: () => false,
    isCancelAfterEnd: () => false,
    isPopup: () => true,
    getPopupPosition: () => 'under',
    afterGuiAttached: () => firstInputRef.current?.focus()
  }))

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  const updateValue = (next) => {
    setSelectedModes(next)
    onValueChange?.(next)
  }

  const isChecked = (mode) =>
    selectedModes.some((item) => item.transportMode === mode)

  const handleToggle = (mode) => {
    if (isChecked(mode)) {
      updateValue(selectedModes.filter((item) => item.transportMode !== mode))
      return
    }
    updateValue([...selectedModes, { transportMode: mode, distance: '' }])
  }

  const handleDistanceChange = (mode, nextDistance) => {
    updateValue(
      selectedModes.map((item) =>
        item.transportMode === mode ? { ...item, distance: nextDistance } : item
      )
    )
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      api.stopEditing(true)
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      api.stopEditing()
    }
  }

  return (
    <Box
      role="group"
      className="ag-custom-component-popup"
      aria-label="Select transport modes and enter distance in kilometers"
      onKeyDown={handleKeyDown}
      sx={{
        width: 460,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 420,
        overflowY: 'auto',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: 3,
        zIndex: (theme) => theme.zIndex.modal,
        p: 2
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2">
          Select transport modes and enter distance (km)
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Add a distance for each selected transport mode.
        </Typography>
      </Stack>

      <Stack spacing={1}>
        {normalizedOptions.map((mode, index) => {
          const selected = selectedModes.find(
            (item) => item.transportMode === mode
          )
          const checked = Boolean(selected)
          return (
            <Stack
              key={mode}
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{
                minHeight: 56,
                py: 0.75,
                borderTop: index === 0 ? 0 : '1px solid',
                borderColor: 'divider'
              }}
            >
              <FormControlLabel
                sx={{ flex: 1, m: 0 }}
                control={
                  <Checkbox
                    checked={checked}
                    onChange={() => handleToggle(mode)}
                    inputRef={index === 0 ? firstInputRef : undefined}
                    inputProps={{ 'aria-label': `Select ${mode}` }}
                  />
                }
                label={<Typography variant="body2">{mode}</Typography>}
              />
              <TextField
                type="number"
                size="small"
                value={selected?.distance ?? ''}
                onChange={(event) =>
                  handleDistanceChange(mode, event.target.value)
                }
                disabled={!checked}
                placeholder="Enter"
                inputProps={{
                  min: 0,
                  step: 1,
                  'aria-label': `${mode} distance in kilometers`
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography variant="body2">km</Typography>
                    </InputAdornment>
                  )
                }}
                sx={{ width: 160 }}
              />
            </Stack>
          )
        })}
      </Stack>
    </Box>
  )
})

TransportModeDistanceCellEditor.propTypes = {
  value: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.string,
    PropTypes.object
  ]),
  options: PropTypes.array.isRequired,
  api: PropTypes.object.isRequired,
  data: PropTypes.object,
  colDef: PropTypes.object,
  onValueChange: PropTypes.func
}

TransportModeDistanceCellEditor.displayName = 'TransportModeDistanceCellEditor'
