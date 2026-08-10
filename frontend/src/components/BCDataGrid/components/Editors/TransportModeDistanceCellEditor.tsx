import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import type { KeyboardEvent } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'

type TransportModeOption =
  | string
  | {
      transportMode?: string
    }

type TransportModeValue =
  | string
  | {
      transportMode?: string
      distance?: string | number | null
    }

type SelectedMode = {
  transportMode: string
  distance: string | number | null
}

type GridEditorApi = {
  stopEditing: (cancel?: boolean) => void
}

type TransportModeDistanceCellEditorRef = {
  getValue: () => Array<{ transportMode: string; distance: number | null }>
  isCancelBeforeStart: () => boolean
  isCancelAfterEnd: () => boolean
}

type TransportModeDistanceCellEditorProps = {
  value?: TransportModeValue | TransportModeValue[]
  options?: TransportModeOption[]
  api: GridEditorApi
  onValueChange?: (value: SelectedMode[]) => void
}

const getOptionLabel = (option: TransportModeOption) => {
  if (option == null) return ''
  if (typeof option === 'string') {
    return option
  }
  return option.transportMode || ''
}

const getModeName = (value: TransportModeValue) => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return value.transportMode || ''
}

const getDistance = (value: TransportModeValue) => {
  if (value && typeof value === 'object') {
    return value.distance ?? ''
  }
  return ''
}

const normalizeValue = (
  value: TransportModeValue | TransportModeValue[] | undefined
): SelectedMode[] => {
  if (!value && value !== 0) return []
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',').map((v) => v.trim())
      : [value]

  return values
    .map((item: TransportModeValue) => ({
      transportMode: getModeName(item),
      distance: getDistance(item)
    }))
    .filter((item) => item.transportMode)
}

export const TransportModeDistanceCellEditor = forwardRef<
  TransportModeDistanceCellEditorRef,
  TransportModeDistanceCellEditorProps
>((props, ref) => {
  const { value, options = [], api, onValueChange } = props
  const { t } = useTranslation(['carbonIntensity', 'common'])
  const normalizedOptions = useMemo(
    () => options.map((option) => getOptionLabel(option)).filter(Boolean),
    [options]
  )
  const [selectedModes, setSelectedModes] = useState(() =>
    normalizeValue(value)
  )
  const firstInputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const getCurrentValue = () =>
    selectedModes.map((item) => ({
      transportMode: item.transportMode,
      distance:
        item.distance === '' ||
        item.distance === null ||
        item.distance === undefined
          ? null
          : Number(item.distance)
    }))

  useImperativeHandle(ref, () => ({
    getValue: () => getCurrentValue(),
    isCancelBeforeStart: () => false,
    isCancelAfterEnd: () => false
  }))

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const handleOutsidePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return
      }
      api.stopEditing()
    }

    const listenerTimer = window.setTimeout(() => {
      document.addEventListener('mousedown', handleOutsidePointerDown, true)
      document.addEventListener('touchstart', handleOutsidePointerDown, true)
    }, 0)

    return () => {
      window.clearTimeout(listenerTimer)
      document.removeEventListener('mousedown', handleOutsidePointerDown, true)
      document.removeEventListener('touchstart', handleOutsidePointerDown, true)
    }
  }, [api])

  const updateValue = (next: SelectedMode[]) => {
    setSelectedModes(next)
    onValueChange?.(next)
  }

  const isChecked = (mode: string) =>
    selectedModes.some((item) => item.transportMode === mode)

  const handleToggle = (mode: string) => {
    if (isChecked(mode)) {
      updateValue(selectedModes.filter((item) => item.transportMode !== mode))
      return
    }
    updateValue([...selectedModes, { transportMode: mode, distance: '' }])
  }

  const handleDistanceChange = (mode: string, nextDistance: string) => {
    updateValue(
      selectedModes.map((item) =>
        item.transportMode === mode ? { ...item, distance: nextDistance } : item
      )
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      api.stopEditing(true)
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      api.stopEditing()
    }
    if (event.key === 'Tab' && rootRef.current) {
      const focusable = Array.from(
        rootRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <Box
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      className="ag-custom-component-popup"
      aria-labelledby="transport-mode-distance-title"
      aria-describedby="transport-mode-distance-description"
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
        zIndex: 1300,
        p: 2
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Typography id="transport-mode-distance-title" variant="subtitle2">
          {t('carbonIntensity:transportModeDistance.title')}
        </Typography>
        <Typography
          id="transport-mode-distance-description"
          variant="caption"
          color="text.secondary"
        >
          {t('carbonIntensity:transportModeDistance.description')}
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
                    inputProps={{
                      'aria-label': t(
                        'carbonIntensity:transportModeDistance.selectMode',
                        { mode }
                      )
                    }}
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
                placeholder={t(
                  'carbonIntensity:transportModeDistance.placeholder'
                )}
                inputProps={{
                  min: 0,
                  step: 1,
                  'aria-label': t(
                    'carbonIntensity:transportModeDistance.distanceLabel',
                    { mode }
                  )
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
      <Stack
        direction="row"
        spacing={1}
        justifyContent="flex-end"
        sx={{ mt: 2 }}
      >
        <Button
          variant="outlined"
          size="small"
          onClick={() => api.stopEditing(true)}
        >
          {t('common:cancelBtn')}
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={() => api.stopEditing()}
        >
          {t('common:doneBtn', 'Done')}
        </Button>
      </Stack>
    </Box>
  )
})

TransportModeDistanceCellEditor.displayName = 'TransportModeDistanceCellEditor'
