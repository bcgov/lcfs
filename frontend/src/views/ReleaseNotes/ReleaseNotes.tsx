import React, { useEffect, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip
} from '@mui/material'
import {
  BugReport,
  ContentCopy,
  DoneAll,
  ExpandLess,
  ExpandMore,
  Extension,
  InfoOutlined,
  MoreHoriz,
  NewReleases,
  OpenInNew,
  SearchRounded,
  Security,
  Warning
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_REPO = 'https://github.com/bcgov/lcfs' as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReleaseSections {
  features: string[]
  fixes: string[]
  security: string[]
  breaking: string[]
  dependencies: string[]
  other: string[]
}

interface Release {
  version: string
  tag: string
  date: string
  releaseUrl: string
  fullChangelogUrl: string
  summary: string
  sections: ReleaseSections
  contributors: string[]
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

const fetchReleaseNotes = async (): Promise<Release[]> => {
  const res = await fetch('/release-notes.json')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Category configuration — 6 categories, BC Gov Design System palette
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    key: 'features' as const,
    i18nKey: 'releaseNotes:categories.features',
    icon: <NewReleases fontSize="small" />,
    color: '#003366',
    bg: '#e8f0fa',
    bcColor: 'primary' as const
  },
  {
    key: 'fixes' as const,
    i18nKey: 'releaseNotes:categories.fixes',
    icon: <BugReport fontSize="small" />,
    color: '#2e8540',
    bg: '#eaf4ec',
    bcColor: 'success' as const
  },
  {
    key: 'security' as const,
    i18nKey: 'releaseNotes:categories.security',
    icon: <Security fontSize="small" />,
    color: '#d8292f',
    bg: '#fdecea',
    bcColor: 'error' as const
  },
  {
    key: 'breaking' as const,
    i18nKey: 'releaseNotes:categories.breaking',
    icon: <Warning fontSize="small" />,
    color: '#d8292f',
    bg: '#fdecea',
    bcColor: 'error' as const
  },
  {
    key: 'dependencies' as const,
    i18nKey: 'releaseNotes:categories.dependencies',
    icon: <Extension fontSize="small" />,
    color: '#6c757d',
    bg: '#f2f2f2',
    bcColor: 'dark' as const
  },
  {
    key: 'other' as const,
    i18nKey: 'releaseNotes:categories.other',
    icon: <MoreHoriz fontSize="small" />,
    color: '#6c757d',
    bg: '#f2f2f2',
    bcColor: 'dark' as const
  }
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a YYYY-MM-DD string as a local calendar date, avoiding the UTC
 * midnight ambiguity that shifts the displayed day by one in negative-offset
 * time zones.
 */
const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Renders text with any `#NNNN` patterns converted to clickable GitHub links.
 * GitHub automatically redirects /issues/NNN to the PR page when NNN is a PR.
 */
function TextWithIssueLinks({ text }: { text: string }) {
  const parts = text.split(/(#\d+)/)
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^#(\d+)$/)
        if (match) {
          return (
            <Link
              key={i}
              href={`${GITHUB_REPO}/issues/${match[1]}`}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{
                fontWeight: 700,
                fontSize: 'inherit',
                color: 'primary.main'
              }}
            >
              {part}
            </Link>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ReleaseNotes = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  // state
  const [expanded, setExpanded] = useState<string | false>('release-0')
  const [filter, setFilter] = useState('')
  const [allExpanded, setAllExpanded] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // data
  const {
    data: releases = [],
    isLoading,
    isError
  } = useQuery<Release[]>({
    queryKey: ['release-notes'],
    queryFn: fetchReleaseNotes,
    staleTime: 5 * 60 * 1000
  })

  // scroll to #hash on load
  const anchorRefs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    if (isLoading || releases.length === 0) return
    const hash = location.hash.replace('#', '')
    if (!hash) return
    const idx = releases.findIndex(
      (r) =>
        r.tag === hash ||
        r.tag === `v${hash}` ||
        `v${r.version}` === hash ||
        r.version === hash
    )
    if (idx === -1) return
    const panelId = `release-${idx}`
    setExpanded(panelId)
    // let accordion open before scroll
    setTimeout(() => {
      anchorRefs.current[panelId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }, 120)
  }, [isLoading, releases, location.hash])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleToggle =
    (panel: string, tag: string) =>
    (_: React.SyntheticEvent, isOpen: boolean) => {
      setExpanded(isOpen ? panel : false)
      // sync URL hash
      navigate({ hash: isOpen ? tag : '' }, { replace: true })
    }

  const handleExpandAll = () => {
    setAllExpanded((v) => !v)
    setExpanded(false)
  }

  const handleCopyLink = (tag: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${tag}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(tag)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  // filter by text search
  const filteredReleases = releases.filter(
    (r) =>
      !filter.trim() ||
      r.version.toLowerCase().includes(filter.toLowerCase()) ||
      r.tag.toLowerCase().includes(filter.toLowerCase()) ||
      r.summary?.toLowerCase().includes(filter.toLowerCase())
  )

  // allExpanded overrides per-panel state
  const isPanelOpen = (panelId: string) => allExpanded || expanded === panelId

  return (
    <BCBox
      component="section"
      aria-label={t('releaseNotes:pageTitle')}
      sx={{ maxWidth: 1080, mx: 'auto', pb: 8 }}
    >
      {/* page header */}
      <Box sx={{ mb: 3 }}>
        <BCTypography
          variant="h5"
          component="h2"
          color="primary"
          fontWeight="bold"
          mb={0.5}
        >
          {t('releaseNotes:pageTitle')}
        </BCTypography>
        <BCTypography variant="body2" color="text">
          {t('releaseNotes:pageSubtitle')}
        </BCTypography>
      </Box>

      {/* toolbar */}
      {!isLoading && !isError && releases.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 4,
            flexWrap: 'wrap'
          }}
        >
          <TextField
            size="small"
            placeholder={t('releaseNotes:searchPlaceholder')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded
                    sx={{
                      fontSize: '1.1rem',
                      color: 'text.secondary',
                      opacity: 0.55
                    }}
                  />
                </InputAdornment>
              )
            }}
            sx={{ width: { xs: '100%', sm: 260 } }}
            inputProps={{
              'aria-label': t('releaseNotes:searchPlaceholder'),
              autoComplete: 'off'
            }}
          />

          <Box sx={{ flexGrow: 1 }} />

          <BCButton
            size="small"
            variant={allExpanded ? 'contained' : 'outlined'}
            color="primary"
            startIcon={allExpanded ? <ExpandLess /> : <DoneAll />}
            onClick={handleExpandAll}
          >
            {allExpanded
              ? t('releaseNotes:collapseAll')
              : t('releaseNotes:expandAll')}
          </BCButton>
        </Box>
      )}

      {/* loading */}
      {isLoading && (
        <Stack spacing={2} data-testid="release-notes-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={68}
              sx={{ borderRadius: 1 }}
            />
          ))}
        </Stack>
      )}

      {/* error */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('releaseNotes:loadError')}
        </Alert>
      )}

      {/* empty */}
      {!isLoading && !isError && releases.length === 0 && (
        <Alert severity="info">{t('releaseNotes:noReleases')}</Alert>
      )}

      {/* no results */}
      {!isLoading &&
        !isError &&
        releases.length > 0 &&
        filteredReleases.length === 0 && (
          <Alert severity="info">
            {t('releaseNotes:searchNoResults', { query: filter.trim() })}
          </Alert>
        )}

      {filteredReleases.length > 0 && (
        <Stack spacing={2}>
          {filteredReleases.map((release, index) => {
            const panelId = `release-${index}`
            const isOpen = isPanelOpen(panelId)
            const isLatest = index === 0
            const date = parseLocalDate(release.date)
            const activeCats = CATEGORIES.filter(
              (c) => release.sections[c.key]?.length > 0
            )
            const totalChanges = activeCats.reduce(
              (sum, c) => sum + release.sections[c.key].length,
              0
            )

            return (
              <Box
                key={release.tag}
                ref={(el) => {
                  anchorRefs.current[panelId] = el as HTMLDivElement | null
                }}
                id={release.tag}
                sx={{ scrollMarginTop: '80px' }}
              >
                <Accordion
                  expanded={isOpen}
                  onChange={handleToggle(panelId, release.tag)}
                  elevation={0}
                  disableGutters
                  data-testid={`release-accordion-${release.tag}`}
                  sx={{
                    border: '1px solid',
                    borderColor: isOpen ? 'primary.main' : '#8c8c8c',
                    borderRadius: '4px !important',
                    transition: 'border-color 0.2s ease',
                    '&:before': { display: 'none' }
                  }}
                >
                  {/* accordion header */}
                  <AccordionSummary
                    expandIcon={
                      <ExpandMore
                        sx={{
                          color: isOpen ? 'primary.main' : 'text.secondary'
                        }}
                      />
                    }
                    aria-controls={`${panelId}-content`}
                    id={`${panelId}-header`}
                    sx={{
                      px: 3,
                      minHeight: '64px',
                      backgroundColor: isOpen ? '#f2f2f2' : 'white',
                      borderRadius: isOpen ? '5px 5px 0 0' : '5px',
                      transition: 'background-color 0.2s ease',
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 1.5,
                        my: 1.25
                      }
                    }}
                  >
                    {/* version */}
                    <BCTypography
                      variant="subtitle1"
                      component="span"
                      color="primary"
                      fontWeight="bold"
                      sx={{ flexShrink: 0 }}
                    >
                      v{release.version}
                    </BCTypography>

                    {/* latest badge */}
                    {isLatest && (
                      <Chip
                        label="LATEST"
                        size="small"
                        sx={{
                          backgroundColor: '#fcba19',
                          color: '#1a1a1a',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          letterSpacing: '0.1em',
                          height: '20px',
                          flexShrink: 0
                        }}
                      />
                    )}

                    {/* date · relative · count */}
                    <BCTypography
                      variant="body2"
                      component="span"
                      color="text"
                      sx={{ flexShrink: 0 }}
                    >
                      {format(date, 'MMM d, yyyy')}
                    </BCTypography>
                    <BCTypography
                      variant="body2"
                      component="span"
                      color="text"
                      sx={{ flexShrink: 0, opacity: 0.5 }}
                    >
                      · {formatDistanceToNow(date, { addSuffix: true })}
                    </BCTypography>
                    {totalChanges > 0 && (
                      <BCTypography
                        variant="body2"
                        component="span"
                        color="text"
                        sx={{ flexShrink: 0, opacity: 0.5 }}
                      >
                        · {totalChanges} change{totalChanges !== 1 ? 's' : ''}
                      </BCTypography>
                    )}

                    {/* spacer */}
                    <Box sx={{ flexGrow: 1 }} />

                    {/* category chips */}
                    {activeCats.slice(0, 3).map((cat) => (
                      <Chip
                        key={cat.key}
                        icon={cat.icon}
                        label={`${release.sections[cat.key].length}\u2009${t(cat.i18nKey)}`}
                        size="small"
                        sx={{
                          backgroundColor: cat.bg,
                          color: cat.color,
                          border: `1px solid ${cat.color}30`,
                          fontSize: '0.78rem',
                          height: '26px',
                          flexShrink: 0,
                          '& .MuiChip-icon': { color: cat.color }
                        }}
                      />
                    ))}

                    {/* copy link */}
                    <Tooltip
                      title={
                        copied === release.tag
                          ? t('releaseNotes:linkCopied')
                          : t('releaseNotes:copyLink')
                      }
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopyLink(release.tag)
                        }}
                        aria-label={t('releaseNotes:copyLink')}
                        sx={{
                          color: copied === release.tag ? '#2e8540' : '#adb5bd',
                          flexShrink: 0,
                          p: 0.5,
                          '&:hover': { color: '#003366' }
                        }}
                      >
                        <ContentCopy sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                    </Tooltip>

                    {/* summary preview (collapsed only) */}
                    {!isOpen && release.summary && (
                      <BCTypography
                        variant="body2"
                        component="p"
                        color="text"
                        sx={{
                          width: '100%',
                          mt: 0.5,
                          mb: 0.25,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {release.summary}
                      </BCTypography>
                    )}
                  </AccordionSummary>

                  {/* accordion body */}
                  <AccordionDetails
                    id={`${panelId}-content`}
                    role="region"
                    aria-labelledby={`${panelId}-header`}
                    sx={{ px: 4, pt: 3, pb: 4 }}
                  >
                    {/* summary callout */}
                    {release.summary && (
                      <BCBox
                        variant="bordered"
                        borderRadius="sm"
                        sx={{
                          display: 'flex',
                          gap: 2,
                          p: 2,
                          mb: 3,
                          borderLeft: '4px solid #003366'
                        }}
                      >
                        <InfoOutlined
                          sx={{
                            color: 'primary.main',
                            fontSize: '1.1rem',
                            flexShrink: 0,
                            mt: '2px'
                          }}
                        />
                        <Box>
                          <BCTypography
                            variant="caption"
                            color="primary"
                            fontWeight="bold"
                            textTransform="uppercase"
                            sx={{
                              display: 'block',
                              letterSpacing: '0.07em',
                              mb: 0.5
                            }}
                          >
                            {t('releaseNotes:summaryLabel')}
                          </BCTypography>
                          <BCTypography variant="body2">
                            {release.summary}
                          </BCTypography>
                        </Box>
                      </BCBox>
                    )}

                    {activeCats.length === 0 && (
                      <BCTypography
                        variant="body2"
                        sx={{ opacity: 0.45, fontStyle: 'italic' }}
                      >
                        {t('releaseNotes:noChangesInRelease')}
                      </BCTypography>
                    )}

                    <Stack spacing={3.5}>
                      {CATEGORIES.map((cat) => {
                        const items = release.sections[cat.key]
                        if (!items?.length) return null

                        return (
                          <Box
                            key={cat.key}
                            sx={{
                              borderLeft: `3px solid ${cat.color}`,
                              pl: 2.5
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.75,
                                mb: 1.5
                              }}
                            >
                              <Box
                                sx={{
                                  color: cat.color,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                aria-hidden="true"
                              >
                                {cat.icon}
                              </Box>
                              <BCTypography
                                variant="subtitle2"
                                component="h3"
                                color="primary"
                                fontWeight="bold"
                                sx={{
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em'
                                }}
                              >
                                {t(cat.i18nKey)}
                              </BCTypography>
                              <Chip
                                label={items.length}
                                size="small"
                                sx={{
                                  height: '18px',
                                  fontSize: '0.68rem',
                                  backgroundColor: cat.bg,
                                  color: cat.color,
                                  border: `1px solid ${cat.color}30`,
                                  '& .MuiChip-label': { px: 0.75 }
                                }}
                              />
                            </Box>

                            <List dense disablePadding>
                              {items.map((item, i) => (
                                <ListItem
                                  key={i}
                                  disableGutters
                                  sx={{
                                    py: 0.5,
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 1.25
                                  }}
                                >
                                  <Box
                                    component="span"
                                    aria-hidden="true"
                                    sx={{
                                      color: cat.color,
                                      fontSize: '1rem',
                                      lineHeight: '1.75',
                                      flexShrink: 0,
                                      userSelect: 'none'
                                    }}
                                  >
                                    ›
                                  </Box>
                                  <BCTypography
                                    variant="body1"
                                    component="span"
                                    sx={{
                                      lineHeight: 1.75,
                                      fontSize: '0.9rem'
                                    }}
                                  >
                                    <TextWithIssueLinks text={item} />
                                  </BCTypography>
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        )
                      })}
                    </Stack>

                    {/* Footer: GitHub links */}
                    {(release.releaseUrl || release.fullChangelogUrl) && (
                      <Box
                        sx={{
                          mt: 4,
                          pt: 2.5,
                          borderTop: '1px solid #dee2e6',
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 1.5,
                          alignItems: 'center'
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 2.5,
                            flexWrap: 'wrap',
                            ml: 'auto'
                          }}
                        >
                          {release.releaseUrl && (
                            <Link
                              href={release.releaseUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              underline="hover"
                              variant="caption"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                color: 'primary.main'
                              }}
                            >
                              {t('releaseNotes:viewOnGitHub')}
                              <OpenInNew sx={{ fontSize: '0.85rem' }} />
                            </Link>
                          )}
                          {release.fullChangelogUrl && (
                            <Link
                              href={release.fullChangelogUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              underline="hover"
                              variant="caption"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                color: 'primary.main'
                              }}
                            >
                              {t('releaseNotes:fullChangelog')}
                              <OpenInNew sx={{ fontSize: '0.85rem' }} />
                            </Link>
                          )}
                        </Box>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              </Box>
            )
          })}
        </Stack>
      )}
    </BCBox>
  )
}

export default ReleaseNotes
