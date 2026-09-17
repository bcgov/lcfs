import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Collapse, IconButton, Paper } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { useDesignatedActionHistory } from '@/hooks/useInitiativeAgreements'
import { timezoneFormatter } from '@/utils/formatters'

// The audit trail behind a designated action (#4898, #5081). Every
// workflow step is recorded; this is where a reviewer reads back what
// happened and, for the rounds that captured it, what the evidence looked
// like at the time.
//
// Entries are grouped by what kind of thing happened. A flat trail on a
// long-lived action mixes assignment churn with the evidence decisions a
// manager or director actually reads; grouping puts the review history in
// one place. The grouping is presentation over a fixed set of event
// types — changing it is this table and its copy, not a data change.

// Snapshot keys are stored as written — snake_case — while the rest of the
// response is camelCase. See DesignatedActionHistorySchema.
const OUTCOME_SATISFACTORY = 'Satisfactory'

const EVENT_LABELS = {
  STATUS_CHANGE: 'statusChange',
  ANALYST_ASSIGNED: 'analystAssigned',
  ANALYST_REASSIGNED: 'analystReassigned',
  ANALYST_UNASSIGNED: 'analystUnassigned',
  CREDITS_RECOMMENDED: 'creditsRecommended',
  INFORMATION_REQUESTED: 'informationRequested',
  EVIDENCE_REVIEWED: 'evidenceReviewed',
  DETAILS_EDITED: 'detailsEdited',
  CHANGE_ORDER: 'changeOrder',
  CREDITS_ISSUED: 'creditsIssued'
}

// In display order. An event no group claims lands in "other" so nothing
// the trail recorded is ever silently dropped from the page.
export const HISTORY_GROUPS = [
  {
    key: 'evidenceReview',
    events: ['EVIDENCE_REVIEWED', 'INFORMATION_REQUESTED']
  },
  {
    key: 'workflow',
    events: ['STATUS_CHANGE', 'CREDITS_RECOMMENDED', 'CREDITS_ISSUED']
  },
  {
    key: 'assignment',
    events: ['ANALYST_ASSIGNED', 'ANALYST_REASSIGNED', 'ANALYST_UNASSIGNED']
  },
  { key: 'recordChanges', events: ['DETAILS_EDITED', 'CHANGE_ORDER'] }
]

export const groupHistory = (entries) => {
  const claimed = new Set(HISTORY_GROUPS.flatMap((group) => group.events))
  const groups = HISTORY_GROUPS.map((group) => ({
    key: group.key,
    // The API lists newest first; the order is kept within each group.
    entries: entries.filter((entry) => group.events.includes(entry.event))
  }))
  groups.push({
    key: 'other',
    entries: entries.filter((entry) => !claimed.has(entry.event))
  })
  return groups.filter((group) => group.entries.length > 0)
}

const railColour = (event) => {
  if (event === 'INFORMATION_REQUESTED') return 'warning.main'
  if (event === 'EVIDENCE_REVIEWED') return 'success.main'
  if (event === 'CREDITS_ISSUED') return 'success.main'
  return 'primary.main'
}

// Requirements recorded before titles existed carry none; the
// description stands in, as it does on the live card.
const requirementHeading = (requirement) =>
  requirement.title || requirement.description

const evidenceCounts = (requirements) => {
  const satisfactory = requirements.filter(
    (r) => r.review_outcome === OUTCOME_SATISFACTORY
  ).length
  return {
    count: requirements.length,
    satisfactory,
    outstanding: requirements.length - satisfactory
  }
}

// The lines an entry's detail is made of, in the order they read.
const detailLines = (entry, t) => {
  const snapshot = entry.snapshot || {}
  const lines = []

  if (entry.event === 'ANALYST_ASSIGNED' && snapshot.to_analyst) {
    lines.push(
      t('initiativeAgreement:history.assignedTo', { name: snapshot.to_analyst })
    )
  }
  if (entry.event === 'ANALYST_REASSIGNED') {
    lines.push(
      t('initiativeAgreement:history.reassigned', {
        from: snapshot.from_analyst || t('initiativeAgreement:history.nobody'),
        to: snapshot.to_analyst || t('initiativeAgreement:history.nobody')
      })
    )
  }
  if (entry.event === 'ANALYST_UNASSIGNED' && snapshot.from_analyst) {
    lines.push(
      t('initiativeAgreement:history.unassignedFrom', {
        name: snapshot.from_analyst
      })
    )
  }
  if (snapshot.recommended_credits !== undefined) {
    lines.push(
      t('initiativeAgreement:history.recommendedCredits', {
        count: Number(snapshot.recommended_credits).toLocaleString()
      })
    )
  }
  if (snapshot.changed) {
    // An edit to an evidence item names the item, so "title: A → B" has
    // something to belong to.
    if (snapshot.requirement_number !== undefined) {
      lines.push(
        t('initiativeAgreement:history.requirementChanged', {
          number: snapshot.requirement_number,
          title: snapshot.requirement_title || ''
        })
      )
    }
    // Show the correction itself: "1,000 to 1,850" is the useful part.
    for (const [field, change] of Object.entries(snapshot.changed)) {
      lines.push(
        t('initiativeAgreement:history.changed', {
          field: t(`initiativeAgreement:history.fields.${field}`, {
            defaultValue: field
          }),
          from: change.from ?? '—',
          to: change.to ?? '—'
        })
      )
    }
  }
  if (entry.status?.status && entry.event === 'STATUS_CHANGE') {
    lines.push(
      t('initiativeAgreement:history.movedTo', { status: entry.status.status })
    )
  }
  return lines
}

const EvidenceList = ({ requirements }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  return (
    <Box
      data-test="history-evidence-detail"
      sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      {requirements.map((requirement) => (
        <Box
          key={requirement.evidence_requirement_id}
          sx={{
            borderLeft: 3,
            borderColor:
              requirement.review_outcome === OUTCOME_SATISFACTORY
                ? 'success.main'
                : 'warning.main',
            pl: 1.5
          }}
        >
          <BCTypography
            variant="body4"
            component="p"
            color="text.secondary"
            sx={{ m: 0 }}
          >
            {requirement.review_outcome ||
              t('initiativeAgreement:history.notReviewed')}
          </BCTypography>
          <BCTypography
            variant="body4"
            component="p"
            sx={{ fontWeight: 700, m: 0 }}
          >
            {requirement.requirement_number != null
              ? `${requirement.requirement_number}. `
              : ''}
            {requirementHeading(requirement)}
          </BCTypography>
          {requirement.analyst_review && (
            <BCTypography variant="body4" component="p" sx={{ m: 0 }}>
              {requirement.analyst_review}
            </BCTypography>
          )}
        </Box>
      ))}
    </Box>
  )
}

// One thing that happened: its title, who and when, a one-line summary
// that reads without expanding, and the detail behind a chevron.
const HistoryEntry = ({ entry }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const [open, setOpen] = useState(false)
  const snapshot = entry.snapshot || {}
  const requirements = Array.isArray(snapshot.evidence_requirements)
    ? snapshot.evidence_requirements
    : []
  const lines = detailLines(entry, t)

  // The collapsed line: for an evidence round, how the evidence stood;
  // otherwise the first thing the detail would say.
  const summary = requirements.length
    ? t(
        'initiativeAgreement:history.evidenceSummary',
        evidenceCounts(requirements)
      )
    : lines[0] || null
  const hasDetail =
    requirements.length > 0 || lines.length > 1 || Boolean(snapshot.comment)
  const id = entry.designatedActionHistoryId
  const detailId = `history-entry-detail-${id}`

  return (
    <Paper
      variant="outlined"
      data-test={`history-entry-${id}`}
      sx={{ p: 2, borderLeft: 4, borderLeftColor: railColour(entry.event) }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <BCTypography variant="body4" sx={{ fontWeight: 700 }}>
          {t(
            `initiativeAgreement:history.events.${
              EVENT_LABELS[entry.event] || 'unknown'
            }`
          )}
        </BCTypography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BCTypography variant="body4" color="text.secondary">
            {[entry.displayName, timezoneFormatter({ value: entry.createDate })]
              .filter(Boolean)
              .join(' · ')}
          </BCTypography>
          {hasDetail && (
            <IconButton
              size="small"
              data-test={`history-entry-toggle-${id}`}
              aria-label={t('initiativeAgreement:history.expandEntry')}
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpen((wasOpen) => !wasOpen)}
            >
              {open ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </IconButton>
          )}
        </Box>
      </Box>

      {summary && (
        <BCTypography
          variant="body4"
          component="p"
          color="text.secondary"
          data-test={`history-entry-summary-${id}`}
          sx={{ m: 0, mt: 0.5 }}
        >
          {summary}
        </BCTypography>
      )}

      {hasDetail && (
        <Collapse in={open}>
          <Box id={detailId} sx={{ mt: 1 }}>
            {(requirements.length ? lines : lines.slice(1)).map((line) => (
              <BCTypography key={line} variant="body4" component="p">
                {line}
              </BCTypography>
            ))}
            {snapshot.comment && (
              <BCTypography
                variant="body4"
                component="p"
                data-test="history-comment"
                sx={{ fontStyle: 'italic', mt: 0.5 }}
              >
                &ldquo;{snapshot.comment}&rdquo;
              </BCTypography>
            )}
            {requirements.length > 0 && (
              <EvidenceList requirements={requirements} />
            )}
          </Box>
        </Collapse>
      )}
    </Paper>
  )
}

const HistoryGroup = ({ group }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  // Open by default: the reader came here to read, and each entry is
  // already summarised on one line.
  const [open, setOpen] = useState(true)
  const bodyId = `history-group-body-${group.key}`

  return (
    <Box data-test={`history-group-${group.key}`}>
      <Box
        component="button"
        type="button"
        data-test={`history-group-toggle-${group.key}`}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          background: 'none',
          border: 'none',
          borderBottom: 1,
          borderColor: 'divider',
          px: 0,
          py: 1,
          mb: 1,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          // The border is stripped for the look, so the focus ring is
          // declared rather than inherited.
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2
          }
        }}
      >
        {open ? (
          <ExpandLessIcon fontSize="small" color="action" />
        ) : (
          <ExpandMoreIcon fontSize="small" color="action" />
        )}
        <BCTypography variant="body4" sx={{ fontWeight: 700 }}>
          {t(`initiativeAgreement:history.groups.${group.key}`)}
        </BCTypography>
        <BCBox
          component="span"
          data-test={`history-group-count-${group.key}`}
          sx={{
            px: 1,
            py: 0.1,
            borderRadius: 4,
            bgcolor: 'action.selected',
            fontSize: '0.8rem'
          }}
        >
          {group.entries.length}
        </BCBox>
      </Box>
      <Collapse in={open}>
        <Box
          id={bodyId}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}
        >
          {group.entries.map((entry) => (
            <HistoryEntry key={entry.designatedActionHistoryId} entry={entry} />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

export const DesignatedActionHistoryPanel = ({ designatedActionId }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [expanded, setExpanded] = useState(true)
  const { data: entries = [], isLoading } =
    useDesignatedActionHistory(designatedActionId)

  return (
    <BCBox mt={3} data-test="designated-action-history">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          pb: 1,
          mb: 2
        }}
      >
        <BCTypography variant="h6" color="primary">
          {t('initiativeAgreement:history.title')}
        </BCTypography>
        <IconButton
          size="small"
          data-test="history-toggle"
          aria-label={t('initiativeAgreement:history.title')}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        {isLoading ? (
          <Loading message={t('initiativeAgreement:history.loading')} />
        ) : entries.length === 0 ? (
          <BCTypography variant="body4" color="text.secondary">
            {t('initiativeAgreement:history.empty')}
          </BCTypography>
        ) : (
          groupHistory(entries).map((group) => (
            <HistoryGroup key={group.key} group={group} />
          ))
        )}
      </Collapse>
    </BCBox>
  )
}

export default DesignatedActionHistoryPanel
