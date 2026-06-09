import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Autocomplete, Box, InputAdornment, TextField } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import BCTypography from '@/components/BCTypography'
import { ClearFiltersButton } from '@/components/ClearFiltersButton'

import { FilterToolbar } from '@/components/FilterToolbar'

const buildOptions = (values) =>
  values.map((v) => ({ label: String(v), value: v }))

/**
 * Filter bar for the organization Comment Log.
 */
export const CommentLogFilters = ({
  filters,
  setFilter,
  clearFilters,
  categories,
  years
}) => {
  const { t } = useTranslation(['internalComment'])
  const searchId = useId()

  const categoryOptions = useMemo(() => buildOptions(categories), [categories])
  const yearOptions = useMemo(() => buildOptions(years), [years])

  const pills = useMemo(() => {
    const out = []
    const push = (id, key, label, value, onRemove) => {
      out.push({
        id,
        label,
        value,
        type: 'select',
        onRemove,
        renderContent: () => (
          <span data-test={`comment-log-chip-${key}`}>
            {label}: {value}
          </span>
        )
      })
    }
    if (filters.category) {
      push(
        'pill-category',
        'category',
        t('internalComment:log.filters.categoryLabel'),
        filters.category,
        () => setFilter('category', null)
      )
    }
    if (filters.complianceYear !== null) {
      push(
        'pill-year',
        'complianceYear',
        t('internalComment:log.filters.yearLabel'),
        String(filters.complianceYear),
        () => setFilter('complianceYear', null)
      )
    }
    if (filters.search?.trim()) {
      push(
        'pill-search',
        'search',
        t('internalComment:log.filters.searchLabel'),
        filters.search.trim(),
        () => setFilter('search', '')
      )
    }
    return out
  }, [filters, setFilter, t])

  const showClearAll = pills.length > 0

  return (
    <Box component="section" aria-label={t('internalComment:log.title')}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          width: '100%'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 2,
            minWidth: 0
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <BCTypography variant="body2" sx={{ fontWeight: 500 }}>
              {t('internalComment:log.filters.searchLabel')}:
            </BCTypography>
            <TextField
              id={searchId}
              data-test="comment-log-search"
              size="small"
              placeholder={t('internalComment:log.filters.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              inputProps={{ maxLength: 500 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" aria-hidden="true" />
                  </InputAdornment>
                )
              }}
              sx={{
                width: 220,
                '& .MuiOutlinedInput-root': { height: '40px' }
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <BCTypography variant="body2" sx={{ fontWeight: 500 }}>
              {t('internalComment:log.filters.categoryLabel')}:
            </BCTypography>
            <Autocomplete
              size="small"
              disablePortal
              options={categoryOptions}
              value={
                categoryOptions.find((o) => o.value === filters.category) ??
                null
              }
              onChange={(_, option) =>
                setFilter('category', option?.value ?? null)
              }
              getOptionLabel={(o) =>
                typeof o === 'string' ? o : (o?.label ?? '')
              }
              sx={{ width: 200 }}
              slotProps={{
                input: {
                  'data-test': 'comment-log-category',
                  'aria-label': t('internalComment:log.filters.categoryLabel')
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('internalComment:log.filters.categoryLabel')}
                  sx={{ '& .MuiOutlinedInput-root': { height: '40px' } }}
                />
              )}
            />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <BCTypography variant="body2" sx={{ fontWeight: 500 }}>
              {t('internalComment:log.filters.yearLabel')}:
            </BCTypography>
            <Autocomplete
              size="small"
              disablePortal
              options={yearOptions}
              value={
                yearOptions.find((o) => o.value === filters.complianceYear) ??
                null
              }
              onChange={(_, option) =>
                setFilter('complianceYear', option?.value ?? null)
              }
              getOptionLabel={(o) =>
                typeof o === 'string' ? o : (o?.label ?? '')
              }
              sx={{ width: 120 }}
              slotProps={{
                input: {
                  'data-test': 'comment-log-year',
                  'aria-label': t('internalComment:log.filters.yearLabel')
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('internalComment:log.filters.yearLabel')}
                  sx={{ '& .MuiOutlinedInput-root': { height: '40px' } }}
                />
              )}
            />
          </Box>

          {pills.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <FilterToolbar
                selectFilters={[]}
                pills={pills}
                onClearAll={clearFilters}
                showClearAll={false}
                sx={{
                  border: 'none',
                  padding: 0,
                  boxShadow: 'none',
                  backgroundColor: 'transparent',
                  minWidth: 0
                }}
              />
            </Box>
          )}
        </Box>

        {showClearAll && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              ml: 'auto',
              flexShrink: 0
            }}
          >
            <Box sx={{ minHeight: '24px' }} />
            <ClearFiltersButton onClick={clearFilters} size="medium" />
          </Box>
        )}
      </Box>
    </Box>
  )
}
