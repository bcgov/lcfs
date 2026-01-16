import { ReactNode } from 'react'
import {
  Autocomplete,
  Box,
  Chip,
  Stack,
  TextField,
  TextFieldProps
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import CloseIcon from '@mui/icons-material/Close'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'
import { FilterToolbarPill } from './filterUtils'
import type { SxProps, Theme } from '@mui/system'

const CONTROL_HEIGHT = 40
const CONTROL_RADIUS = 20

export interface FilterSelectConfig<TOption = any> {
  id: string
  label?: string
  placeholder?: string
  value: TOption | TOption[] | null
  options: TOption[]
  onChange: (option: TOption | TOption[] | null) => void
  getOptionLabel?: (option: TOption) => string
  renderOption?: (props: any, option: TOption) => ReactNode
  isLoading?: boolean
  width?: number | string
  disabled?: boolean
  noOptionsText?: string
  groupBy?: (option: TOption) => string
  multiple?: boolean
  isOptionEqualToValue?: (option: TOption, value: TOption) => boolean
  textFieldProps?: Partial<TextFieldProps>
}

interface FilterToolbarProps {
  selectFilters?: FilterSelectConfig[]
  pills?: FilterToolbarPill[]
  onClearAll?: () => void
  showClearAll?: boolean
  clearAllDisabled?: boolean
  sx?: SxProps<Theme>
}

export const FilterToolbar = ({
  selectFilters = [],
  pills = [],
  onClearAll,
  showClearAll = Boolean(onClearAll),
  clearAllDisabled = false,
  sx
}: FilterToolbarProps) => {
  const shouldRender =
    selectFilters.length > 0 || pills.length > 0 || showClearAll

  if (!shouldRender) {
    return null
  }

  const resolvedSx = Array.isArray(sx) ? sx : sx ? [sx] : []

  return (
    <Box
      className="filter-toolbar"
      sx={[
        (theme) => ({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          columnGap: theme.spacing(1.5),
          rowGap: theme.spacing(1.5),
          padding: theme.spacing(1.5),
          backgroundColor: theme.palette.background.paper,
          borderRadius: `${CONTROL_RADIUS * 0.5}px`,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
          width: '100%'
        }),
        ...resolvedSx
      ]}
    >
      {selectFilters.map((filter) => (
        <Box
          key={filter.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          {filter.label && (
            <BCTypography
              variant="body2"
              sx={{ fontWeight: 500 }}
              color="text.primary"
            >
              {filter.label}
            </BCTypography>
          )}

          <Autocomplete
            size="small"
            disablePortal
            options={filter.options}
            value={filter.value as any}
            onChange={(_, option) => filter.onChange(option)}
            getOptionLabel={
              filter.getOptionLabel
                ? (option) => filter.getOptionLabel?.(option as never)
                : (option) => {
                    if (typeof option === 'string') {
                      return option
                    }
                    if (
                      option &&
                      typeof option === 'object' &&
                      'label' in option
                    ) {
                      return (option as { label?: string }).label || ''
                    }
                    return ''
                  }
            }
            renderOption={filter.renderOption as any}
            loading={filter.isLoading}
            disabled={filter.disabled}
            groupBy={filter.groupBy as any}
            noOptionsText={filter.noOptionsText}
            multiple={filter.multiple}
            isOptionEqualToValue={
              filter.isOptionEqualToValue ||
              ((option, value) => {
                if (
                  typeof option === 'object' &&
                  option !== null &&
                  'value' in option &&
                  typeof value === 'object' &&
                  value !== null &&
                  'value' in value
                ) {
                  return option.value === value.value
                }
                return option === value
              })
            }
            sx={{
              minWidth: 240,
              width: filter.width || 'auto',
              '& .MuiOutlinedInput-root': {
                borderRadius: `${CONTROL_RADIUS}px`,
                paddingX: 1,
                height: `${CONTROL_HEIGHT}px`
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={filter.placeholder}
                {...filter.textFieldProps}
              />
            )}
          />
        </Box>
      ))}

      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        alignItems="center"
        justifyContent="flex-start"
        sx={{
          flex: 1,
          minWidth: 220,
          width: '100%',
          rowGap: 1,
          columnGap: 1,
          mt: 0.5
        }}
      >
        {pills.map((pill) => {
          const defaultLabelText = pill.value
            ? `${pill.label}: ${pill.value}`
            : pill.label
          const defaultContent = (
            <Box
              component="span"
              display="inline-flex"
              alignItems="center"
              gap={0.5}
            >
              <span>{defaultLabelText}</span>
              {pill.sortDirection === 'asc' && (
                <ArrowDropUpIcon fontSize="small" />
              )}
              {pill.sortDirection === 'desc' && (
                <ArrowDropDownIcon fontSize="small" />
              )}
            </Box>
          )

          const labelContent =
            typeof pill.renderContent === 'function'
              ? pill.renderContent(pill)
              : defaultContent

          return (
            <Chip
              key={pill.id}
              label={labelContent}
              onDelete={pill.onRemove}
              variant="outlined"
              sx={(theme) => ({
                borderRadius: `${CONTROL_RADIUS}px`,
                height: `${CONTROL_HEIGHT}px`,
                borderColor: theme.palette.primary.light,
                backgroundColor:
                  pill.type === 'preset' || pill.type === 'select'
                    ? alpha(theme.palette.primary.light, 0.15)
                    : pill.type === 'sort'
                      ? alpha(theme.palette.info.light, 0.2)
                      : alpha(theme.palette.grey[200], 0.8),
                '& .MuiChip-label': {
                  fontWeight: 500,
                  paddingX: theme.spacing(1.5)
                },
                '& .MuiChip-deleteIcon': {
                  color: theme.palette.text.primary,
                  width: '1rem',
                  height: '1rem'
                }
              })}
              deleteIcon={<CloseIcon />}
              clickable={Boolean(pill.onRemove)}
            />
          )
        })}
      </Stack>

      {showClearAll && onClearAll && (
        <ClearFiltersButton
          onClick={onClearAll}
          size="medium"
          disabled={clearAllDisabled}
          sx={{
            height: `${CONTROL_HEIGHT}px`,
            borderRadius: `${CONTROL_RADIUS}px`,
            paddingX: 2,
            minWidth: 'fit-content'
          }}
        />
      )}
    </Box>
  )
}
