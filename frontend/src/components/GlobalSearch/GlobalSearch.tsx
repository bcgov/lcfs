import React, {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  CircularProgress,
  Dialog,
  Fade,
  Button,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import BCButton from '@/components/BCButton'
import {
  useGlobalSearch,
  type SearchGroup,
  type SearchResultItem
} from '@/hooks/useSearch'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { findPages } from './pages'

const BC_NAVY = '#013366'
const BC_GOLD = '#fcba19'
const TEXT = '#2d2d2d'
const MUTED = '#474543'
const BORDER = '#d8d8d8'
const SURFACE = '#faf9f8'
const SELECT = 'rgba(56, 89, 138, 0.12)'
const ACTIVE_BLUE = '#38598a'
const RADIUS = '4px'

const FILTER_KEYS = ['status', 'year', 'city', 'org', 'type', 'fuel', 'id']
const FILTER_RE = new RegExp(`\\b(${FILTER_KEYS.join('|')}):(\\S+)`, 'gi')

const STORAGE_KEY = 'lcfs-recent-searches'
const MAX_RECENT = 5
const getRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}
const saveRecent = (q: string) =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      [q, ...getRecent().filter((r) => r !== q)].slice(0, MAX_RECENT)
    )
  )
const removeRecent = (q: string) =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(getRecent().filter((r) => r !== q))
  )
const clearRecent = () => localStorage.removeItem(STORAGE_KEY)

const SEARCH_GUIDE: Array<{ label: string; tags: string[] }> = [
  { label: 'Pages', tags: ['Section name', 'Menu item', 'Keyword'] },
  {
    label: 'Organizations',
    tags: ['Name', 'Code', 'City', 'Contact', 'Email']
  },
  {
    label: 'Compliance reports',
    tags: ['Supplier', 'Year', 'Type', 'Status', 'ID']
  },
  { label: 'Transfers', tags: ['Supplier', 'ID', 'Status', 'Year'] },
  { label: 'Fuel codes', tags: ['Code', 'Company', 'Fuel type', 'Status'] },
  { label: 'CI applications', tags: ['Supplier', 'ID', 'City', 'Status'] },
  { label: 'Initiative agreements', tags: ['Supplier', 'ID', 'Status'] },
  { label: 'Users', tags: ['Name', 'Email', 'Title', 'Role', 'Status'] }
]

const NO_RESULTS_NOTE =
  'Try broader terms, or use advanced filters in the relevant section of the portal.'
const SEARCH_NOTE =
  'You can also browse or filter records in the relevant section of the portal.'

function Mark({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>
  const tokens = query
    .replace(FILTER_RE, (_match, _key, value) => ` ${value} `)
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (!tokens.length) return <>{text}</>

  const matcher = new RegExp(`(${tokens.join('|')})`, 'gi')
  return (
    <>
      {text.split(matcher).map((part, index) =>
        tokens.some(
          (token) =>
            part.toLowerCase() === token.replace(/\\/g, '').toLowerCase()
        ) ? (
          <Box
            key={`${part}-${index}`}
            component="mark"
            sx={{
              bgcolor: '#faedd1',
              color: 'inherit',
              fontWeight: 600,
              px: 0.15,
              borderRadius: '3px'
            }}
          >
            {part}
          </Box>
        ) : (
          <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        )
      )}
    </>
  )
}

const getSearchTokens = (query: string) =>
  query
    .replace(FILTER_RE, (_match, _key, value) => ` ${value} `)
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 2)

const needsMatchContext = (item: SearchResultItem, query: string) => {
  if (!item.matchContext) return false
  const visibleText = [
    item.title,
    item.subtitle,
    item.meta,
    item.status,
    ...(item.details ?? []).flatMap(({ label, value }) => [label, value])
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
  return getSearchTokens(query).some(
    (token) => !visibleText.includes(token.toLocaleLowerCase())
  )
}

type ResultDetail = { label: string; value: string }

const parseMatchContext = (context: string): ResultDetail => {
  const separatorIndex = context.indexOf(': ')
  if (separatorIndex === -1)
    return { label: 'Additional detail', value: context }
  return {
    label: context.slice(0, separatorIndex),
    value: context.slice(separatorIndex + 2)
  }
}

const DetailList = ({
  details,
  query
}: {
  details: ResultDetail[]
  query: string
}) => (
  <Box
    component="dl"
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      columnGap: 2,
      rowGap: 0.45,
      minWidth: 0,
      m: 0,
      mt: 0.65
    }}
  >
    {details.map(({ label, value }, index) => (
      <Box
        component="div"
        key={`${label}-${value}-${index}`}
        sx={{ display: 'flex', minWidth: 0, gap: 0.5 }}
      >
        <Typography
          component="dt"
          noWrap
          sx={{
            color: MUTED,
            fontSize: '0.8125rem',
            fontWeight: 600,
            lineHeight: 1.4
          }}
        >
          {label}:
        </Typography>
        <Typography
          component="dd"
          noWrap
          title={value}
          sx={{
            m: 0,
            color: TEXT,
            fontSize: '0.8125rem',
            fontWeight: 400,
            lineHeight: 1.4
          }}
        >
          <Mark text={value} query={query} />
        </Typography>
      </Box>
    ))}
  </Box>
)

interface RowProps {
  title: ReactNode
  subtitle?: string
  meta?: string | null
  status?: string | null
  matchContext?: string | null
  details?: ResultDetail[]
  query: string
  trailing?: ReactNode
  isSelected?: boolean
  onMouseEnter?: () => void
  onClick: () => void
}

const ResultRow = forwardRef<HTMLDivElement, RowProps>(
  (
    {
      title,
      subtitle,
      meta,
      status,
      matchContext,
      details,
      query,
      trailing,
      isSelected = false,
      onMouseEnter,
      onClick
    },
    ref
  ) => (
    <Box
      ref={ref}
      role="option"
      aria-selected={isSelected}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        px: 2.25,
        py: 1.5,
        borderBottom: `1px solid ${BORDER}`,
        bgcolor: isSelected ? SELECT : '#fff',
        boxShadow: isSelected
          ? `inset 4px 0 0 ${ACTIVE_BLUE}`
          : 'inset 4px 0 0 transparent',
        transition: 'background-color 120ms ease, box-shadow 120ms ease',
        '&:last-of-type': { borderBottom: 0 },
        '&:hover': { bgcolor: SELECT },
        '& *': { cursor: 'pointer !important' },
        '&:hover .result-row-arrow': {
          color: ACTIVE_BLUE,
          opacity: 1
        }
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
          <Typography
            noWrap
            sx={{
              fontWeight: 700,
              color: TEXT,
              lineHeight: 1.35,
              fontSize: '0.9375rem'
            }}
          >
            {title}
          </Typography>
          {status && (
            <Typography
              noWrap
              sx={{
                color: MUTED,
                fontSize: '0.8125rem',
                fontWeight: 400,
                flexShrink: 0,
                lineHeight: 1.35
              }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>
                Status:
              </Box>{' '}
              <Mark text={status} query={query} />
            </Typography>
          )}
        </Box>
        {details && details.length > 0 ? (
          <DetailList
            details={[
              ...details,
              ...(matchContext ? [parseMatchContext(matchContext)] : [])
            ]}
            query={query}
          />
        ) : subtitle || meta ? (
          <Typography
            noWrap
            sx={{
              color: MUTED,
              display: 'block',
              lineHeight: 1.35,
              fontSize: '0.8125rem',
              mt: 0.15
            }}
          >
            {subtitle && <Mark text={subtitle} query={query} />}
            {subtitle && meta && ' · '}
            {meta && <Mark text={meta} query={query} />}
          </Typography>
        ) : null}
        {matchContext && (!details || details.length === 0) && (
          <DetailList
            details={[parseMatchContext(matchContext)]}
            query={query}
          />
        )}
      </Box>
      {trailing ?? (
        <ChevronRightIcon
          className="result-row-arrow"
          aria-hidden="true"
          sx={{
            alignSelf: 'center',
            mr: 0.25,
            color: isSelected ? ACTIVE_BLUE : MUTED,
            fontSize: 18,
            flexShrink: 0,
            opacity: isSelected ? 1 : 0.45,
            transition: 'color 120ms ease, opacity 120ms ease'
          }}
        />
      )}
    </Box>
  )
)
ResultRow.displayName = 'ResultRow'

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebounced] = useState('')
  const [selectedIndex, setSelected] = useState(0)
  const [sectionFilter, setSectionFilter] = useState('all')
  const [recents, setRecents] = useState<string[]>([])
  const anchorRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/.test(navigator.platform)
  const shortcut = isMac ? '⌘ K' : 'Ctrl K'
  const shortcutAriaLabel = isMac ? 'Command K' : 'Control K'
  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const isGov = currentUser?.isGovernmentUser ?? false

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 260)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setSelected(0)
    setSectionFilter('all')
  }, [debouncedQuery])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const hasPlatformModifier = isMac ? e.metaKey : e.ctrlKey
      if (hasPlatformModifier && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [isMac])

  useEffect(() => {
    if (open) {
      setRecents(getRecent())
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  useEffect(() => {
    const selected = selectedRef.current
    const list = resultsRef.current
    if (!selected || !list) return
    const selectedBox = selected.getBoundingClientRect()
    const listBox = list.getBoundingClientRect()
    if (selectedBox.bottom > listBox.bottom) {
      list.scrollTop += selectedBox.bottom - listBox.bottom
    } else if (selectedBox.top < listBox.top) {
      list.scrollTop -= listBox.top - selectedBox.top
    }
  }, [selectedIndex])

  const { data, isFetching } = useGlobalSearch(debouncedQuery)

  useLayoutEffect(() => {
    const list = resultsRef.current
    if (list) list.scrollTop = 0
  }, [debouncedQuery, data, sectionFilter])
  const hasQuery = debouncedQuery.length >= 2
  const pageItems: SearchResultItem[] = hasQuery
    ? findPages(debouncedQuery, isGov, hasAnyRole).map((page, index) => ({
        entityType: 'page',
        entityId: index,
        title: page.label,
        subtitle: page.section,
        details: [{ label: 'Section', value: page.section }],
        route: page.route
      }))
    : []
  const pageGroups: SearchGroup[] = pageItems.length
    ? [{ entityType: 'page', label: 'Pages', items: pageItems }]
    : []
  const groups: SearchGroup[] = [...pageGroups, ...(data?.groups ?? [])]
  const filteredGroups =
    sectionFilter === 'all'
      ? groups
      : groups.filter((group) => group.entityType === sectionFilter)
  const allItems: SearchResultItem[] = groups.flatMap((group) => group.items)
  const visibleItems: SearchResultItem[] = filteredGroups.flatMap(
    (group) => group.items
  )
  const total = allItems.length
  const visibleTotal = visibleItems.length
  const activeGroup = groups.find((group) => group.entityType === sectionFilter)

  const close = () => {
    setOpen(false)
    setQuery('')
    setDebounced('')
    setSelected(0)
    setSectionFilter('all')
  }

  const go = (route: string, q?: string) => {
    if (q) saveRecent(q)
    close()
    navigate(route)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((i) => Math.min(i + 1, visibleItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && visibleItems[selectedIndex]) {
      e.preventDefault()
      go(visibleItems[selectedIndex].route, debouncedQuery || undefined)
    } else if (e.key === 'Escape') {
      close()
    }
  }

  const showNone = hasQuery && total === 0 && !!data && !isFetching
  const showResults = hasQuery && total > 0
  const guide = isGov
    ? SEARCH_GUIDE
    : SEARCH_GUIDE.filter((row) => row.label !== 'Organizations')

  return (
    <>
      <Box
        sx={{
          alignSelf: 'stretch',
          display: 'flex',
          alignItems: 'center',
          mx: 0.5
        }}
      >
        <Tooltip title={shortcut} disableInteractive>
          <BCButton
            ref={anchorRef}
            color="light"
            size="small"
            variant="outlined"
            startIcon={<SearchIcon sx={{ width: '18px', height: '18px' }} />}
            aria-label={`Search portal, keyboard shortcut ${shortcutAriaLabel}`}
            aria-haspopup="dialog"
            aria-expanded={open}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() => {
              setOpen((current) => !current)
            }}
            sx={{
              maxHeight: '32px',
              '&:focus:not(:hover)': {
                boxShadow: 'none'
              },
              '&.Mui-focusVisible': {
                outline: `2px solid ${BC_GOLD}`,
                outlineOffset: 2
              },
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                color: 'rgba(0, 0, 0, 0.8)',
                borderColor: 'rgba(0, 0, 0, 0.8)'
              }
            }}
          >
            Search portal
          </BCButton>
        </Tooltip>
      </Box>

      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="md"
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 140 }}
        sx={{
          zIndex: (theme) => theme.zIndex.modal + 3,
          '& .MuiDialog-container': {
            alignItems: 'flex-start',
            justifyContent: 'center',
            pt: { xs: '48px', sm: '72px', md: '96px' },
            pb: 2,
            overflow: 'hidden'
          },
          '& .MuiBackdrop-root': { bgcolor: 'rgba(49, 49, 50, 0.45)' }
        }}
        PaperProps={{
          elevation: 0,
          sx: {
            display: 'flex',
            flexDirection: 'column',
            borderRadius: RADIUS,
            overflow: 'hidden',
            border: '1px solid #898785',
            borderTop: `4px solid ${BC_GOLD}`,
            bgcolor: '#fff',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.24)',
            m: 0,
            maxWidth: '1040px',
            width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)' },
            maxHeight: {
              xs: 'calc(100vh - 64px)',
              sm: 'calc(100vh - 92px)',
              md: 'calc(100vh - 116px)'
            }
          }
        }}
        aria-labelledby="global-search-title"
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 3,
            py: 1.4,
            bgcolor: BC_NAVY,
            flexShrink: 0
          }}
        >
          <Typography
            id="global-search-title"
            component="h2"
            sx={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3
            }}
          >
            Search portal
          </Typography>
          <IconButton
            size="small"
            aria-label="Close search"
            onClick={close}
            sx={{
              color: 'rgba(255, 255, 255, 0.85)',
              '&:hover': {
                color: '#fff',
                bgcolor: 'rgba(255, 255, 255, 0.12)'
              },
              '&.Mui-focusVisible': {
                outline: `2px solid ${BC_GOLD}`,
                outlineOffset: 1
              }
            }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        <Box
          sx={{
            px: 3,
            py: 2,
            bgcolor: '#f5f5f5',
            flexShrink: 0
          }}
        >
          <TextField
            inputRef={inputRef}
            autoFocus
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Search all portal content"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="off"
            inputProps={{ 'aria-label': 'Search all portal content' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {isFetching ? (
                    <CircularProgress size={18} />
                  ) : (
                    <SearchIcon sx={{ fontSize: 20, color: BC_NAVY }} />
                  )}
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery('')
                      inputRef.current?.focus()
                    }}
                    sx={{ color: MUTED }}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ) : undefined
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                height: 46,
                bgcolor: '#fff',
                borderRadius: '4px',
                '& fieldset': { borderColor: '#898785' },
                '&:hover fieldset': { borderColor: ACTIVE_BLUE },
                '&.Mui-focused fieldset': {
                  borderColor: ACTIVE_BLUE,
                  borderWidth: 2
                }
              },
              '& .MuiInputBase-input': {
                fontSize: '1rem',
                fontWeight: 400,
                lineHeight: 1.4,
                color: TEXT,
                '&::placeholder': {
                  opacity: 1,
                  color: MUTED
                }
              }
            }}
          />
        </Box>

        <Box
          sx={{
            flex: '1 1 520px',
            minHeight: 0,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            borderTop: `1px solid ${BORDER}`,
            bgcolor: '#fff',
            overflow: 'hidden'
          }}
        >
          {showResults && groups.length > 1 && (
            <Box
              component="nav"
              aria-label="Result type"
              sx={{
                display: 'flex',
                flexDirection: { xs: 'row', sm: 'column' },
                gap: 0.25,
                width: { xs: '100%', sm: 200 },
                p: { xs: 0.75, sm: 1.25 },
                flexShrink: 0,
                overflowX: { xs: 'auto', sm: 'visible' },
                overflowY: { xs: 'hidden', sm: 'auto' },
                bgcolor: SURFACE,
                borderBottom: { xs: `1px solid ${BORDER}`, sm: 0 },
                borderRight: { xs: 0, sm: `1px solid ${BORDER}` }
              }}
            >
              <Typography
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  px: 1,
                  pt: 0.25,
                  pb: 0.65,
                  color: BC_NAVY,
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  lineHeight: 1.4
                }}
              >
                Result type
              </Typography>
              {[
                { value: 'all', label: 'All results', count: total },
                ...groups.map((group) => ({
                  value: group.entityType,
                  label: group.label,
                  count: group.items.length
                }))
              ].map((option) => {
                const isActive = sectionFilter === option.value
                return (
                  <Button
                    key={option.value}
                    type="button"
                    size="small"
                    aria-pressed={isActive}
                    onClick={() => {
                      setSectionFilter(option.value)
                      setSelected(0)
                    }}
                    sx={{
                      justifyContent: 'space-between',
                      gap: 1,
                      minWidth: { xs: 'max-content', sm: 0 },
                      width: { xs: 'auto', sm: '100%' },
                      px: 1,
                      py: 0.6,
                      border: 0,
                      borderRadius: '2px',
                      bgcolor: isActive ? SELECT : 'transparent',
                      boxShadow: 'none',
                      color: isActive ? BC_NAVY : TEXT,
                      fontSize: '0.8125rem',
                      fontWeight: isActive ? 600 : 400,
                      lineHeight: 1.35,
                      letterSpacing: 0,
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: isActive ? SELECT : 'rgba(56, 89, 138, 0.08)',
                        color: BC_NAVY
                      },
                      '&.Mui-focusVisible': {
                        outline: `2px solid ${ACTIVE_BLUE}`,
                        outlineOffset: 1
                      }
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'left'
                      }}
                    >
                      {option.label}
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        color: MUTED,
                        fontSize: '0.75rem',
                        fontWeight: 400
                      }}
                    >
                      {option.count}
                    </Box>
                  </Button>
                )
              })}
            </Box>
          )}

          <Box
            ref={resultsRef}
            role="listbox"
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              overflowY: 'auto',
              overflowAnchor: 'none',
              bgcolor: '#fff',
              overscrollBehavior: 'contain'
            }}
          >
            {showResults && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  px: 2.5,
                  py: 1.25,
                  bgcolor: '#fff',
                  borderBottom: `1px solid ${BORDER}`
                }}
              >
                <Typography
                  sx={{
                    color: BC_NAVY,
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    lineHeight: 1.35
                  }}
                >
                  {sectionFilter === 'all' ? 'All results' : activeGroup?.label}
                </Typography>
                <Typography
                  aria-live="polite"
                  sx={{
                    color: MUTED,
                    fontSize: '0.8125rem',
                    lineHeight: 1.35,
                    flexShrink: 0
                  }}
                >
                  {sectionFilter === 'all'
                    ? `${total} result${total === 1 ? '' : 's'}`
                    : `${visibleTotal} of ${total} results`}
                </Typography>
              </Box>
            )}

            {!hasQuery && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    md: recents.length
                      ? 'minmax(220px, 0.75fr) minmax(0, 1.75fr)'
                      : 'minmax(0, 1fr)'
                  },
                  gap: 3,
                  px: 3,
                  py: 2.25,
                  alignItems: 'start'
                }}
              >
                {recents.length > 0 && (
                  <Box component="section" aria-labelledby="recent-heading">
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        mb: 1.25
                      }}
                    >
                      <Typography
                        id="recent-heading"
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: BC_NAVY,
                          lineHeight: 1.3
                        }}
                      >
                        Recent searches
                      </Typography>
                      <Button
                        type="button"
                        size="small"
                        onClick={() => {
                          clearRecent()
                          setRecents([])
                        }}
                        sx={{
                          minWidth: 0,
                          p: 0,
                          color: BC_NAVY,
                          fontSize: '0.75rem',
                          fontWeight: 400,
                          letterSpacing: 0,
                          lineHeight: 1.4,
                          textTransform: 'none',
                          '&:hover': {
                            bgcolor: 'transparent',
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        Clear
                      </Button>
                    </Box>
                    <List
                      disablePadding
                      sx={{
                        border: `1px solid ${BORDER}`,
                        borderRadius: RADIUS,
                        overflow: 'hidden'
                      }}
                    >
                      {recents.map((recent, index) => (
                        <ListItem
                          key={recent}
                          disablePadding
                          sx={{
                            borderTop:
                              index === 0 ? 'none' : `1px solid ${BORDER}`,
                            '&:hover .recent-search-remove, &:focus-within .recent-search-remove':
                              { opacity: 1 }
                          }}
                          secondaryAction={
                            <IconButton
                              className="recent-search-remove"
                              edge="end"
                              size="small"
                              aria-label={`Remove ${recent} from recent searches`}
                              onClick={() => {
                                removeRecent(recent)
                                setRecents(getRecent())
                              }}
                              sx={{
                                color: MUTED,
                                mr: 0.25,
                                opacity: { xs: 1, sm: 0 },
                                transition: 'opacity 120ms ease',
                                '&:hover': {
                                  color: BC_NAVY,
                                  bgcolor: SELECT
                                }
                              }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          }
                        >
                          <ListItemButton
                            onClick={() => {
                              setQuery(recent)
                              inputRef.current?.focus()
                            }}
                            sx={{
                              minHeight: 42,
                              px: 1.5,
                              py: 0.7,
                              pr: 5,
                              '&:hover': { bgcolor: SELECT },
                              '&.Mui-focusVisible': {
                                bgcolor: SELECT,
                                outline: `2px solid ${ACTIVE_BLUE}`,
                                outlineOffset: -2
                              }
                            }}
                          >
                            <ListItemText
                              primary={recent}
                              primaryTypographyProps={{
                                noWrap: true,
                                sx: {
                                  color: TEXT,
                                  fontSize: '0.875rem',
                                  lineHeight: 1.4
                                }
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                <Box component="section" aria-labelledby="search-guide-heading">
                  <Typography
                    id="search-guide-heading"
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: BC_NAVY,
                      mb: 1.25,
                      lineHeight: 1.3
                    }}
                  >
                    What you can search
                  </Typography>
                  <Box
                    sx={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: RADIUS,
                      overflow: 'hidden'
                    }}
                  >
                    {guide.map(({ label, tags }, index) => (
                      <Box
                        key={label}
                        sx={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 2,
                          px: 2,
                          py: 1.25,
                          bgcolor: index % 2 === 1 ? SURFACE : '#fff',
                          borderTop:
                            index === 0 ? 'none' : `1px solid ${BORDER}`
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: BC_NAVY,
                            lineHeight: 1.4,
                            flexShrink: 0
                          }}
                        >
                          {label}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.8125rem',
                            color: MUTED,
                            lineHeight: 1.4,
                            textAlign: 'right'
                          }}
                        >
                          {tags.join(', ')}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            {showNone && (
              <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
                <Typography
                  sx={{ fontSize: '1rem', color: BC_NAVY, fontWeight: 700 }}
                >
                  No results found for “{debouncedQuery}”
                </Typography>
                <Typography
                  sx={{
                    mt: 0.75,
                    fontSize: '0.875rem',
                    color: MUTED,
                    lineHeight: 1.5
                  }}
                >
                  {NO_RESULTS_NOTE}
                </Typography>
              </Box>
            )}

            {showResults &&
              filteredGroups.map((group) => (
                <Box key={group.entityType}>
                  {sectionFilter === 'all' && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2.5,
                        py: 0.9,
                        bgcolor: SURFACE,
                        borderBottom: `1px solid ${BORDER}`,
                        borderTop: `1px solid ${BORDER}`,
                        position: 'sticky',
                        top: 0,
                        zIndex: 1
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: BC_NAVY,
                          lineHeight: 1.3
                        }}
                      >
                        <Mark text={group.label} query={debouncedQuery} />
                      </Typography>
                      <Typography
                        aria-label={`${group.items.length} results`}
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: 400,
                          color: MUTED
                        }}
                      >
                        {group.items.length}{' '}
                        {group.items.length === 1 ? 'result' : 'results'}
                      </Typography>
                    </Box>
                  )}
                  {group.items.map((item) => {
                    const gIdx = visibleItems.indexOf(item)
                    const isSel = gIdx === selectedIndex
                    return (
                      <ResultRow
                        key={`${item.entityType}-${item.entityId}`}
                        ref={isSel ? selectedRef : undefined}
                        isSelected={isSel}
                        title={
                          <Mark text={item.title} query={debouncedQuery} />
                        }
                        subtitle={item.subtitle || undefined}
                        meta={item.meta}
                        status={item.status ?? undefined}
                        matchContext={
                          needsMatchContext(item, debouncedQuery)
                            ? item.matchContext
                            : undefined
                        }
                        details={item.details}
                        query={debouncedQuery}
                        onMouseEnter={() => setSelected(gIdx)}
                        onClick={() =>
                          go(item.route, debouncedQuery || undefined)
                        }
                      />
                    )
                  })}
                </Box>
              ))}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 3,
            py: 1.1,
            bgcolor: SURFACE,
            borderTop: `1px solid ${BORDER}`,
            minHeight: 42,
            flexShrink: 0
          }}
        >
          <Typography
            sx={{
              minWidth: 0,
              fontSize: '0.75rem',
              fontWeight: 400,
              color: MUTED,
              lineHeight: 1.4
            }}
          >
            {SEARCH_NOTE}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.8125rem',
              color: MUTED,
              flexShrink: 0
            }}
          >
            Press Esc to close
          </Typography>
        </Box>
      </Dialog>
    </>
  )
}
