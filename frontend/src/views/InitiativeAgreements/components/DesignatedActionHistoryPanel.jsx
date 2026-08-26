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

// The audit trail behind a designated action (#4898). Every workflow step
// is recorded; this is where a reviewer reads back what happened and, for
// the rounds that captured it, what the evidence looked like at the time.

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
  CHANGE_ORDER: 'changeOrder',
  CREDITS_ISSUED: 'creditsIssued'
}

const railColour = (event) => {
  if (event === 'INFORMATION_REQUESTED') return 'warning.main'
  if (event === 'EVIDENCE_REVIEWED') return 'success.main'
  if (event === 'CREDITS_ISSUED') return 'success.main'
  return 'primary.main'
}

const EvidenceDetail = ({ requirements }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const [open, setOpen] = useState(false)

  const satisfactory = requirements.filter(
    (r) => r.review_outcome === OUTCOME_SATISFACTORY
  ).length
  const outstanding = requirements.length - satisfactory

  return (
    <Box sx={{ mt: 1 }}>
      <BCTypography
        component="button"
        variant="body4"
        color="link"
        data-test="history-evidence-toggle"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        sx={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline'
        }}
      >
        {t('initiativeAgreement:history.evidenceSummary', {
          count: requirements.length,
          satisfactory,
          outstanding
        })}
      </BCTypography>
      <Collapse in={open}>
        <Box
          data-test="history-evidence-detail"
          sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
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
              <BCTypography variant="body4" sx={{ fontWeight: 600 }}>
                {requirement.description}
              </BCTypography>
              <BCTypography
                variant="body4"
                component="p"
                color="text.secondary"
              >
                {requirement.review_outcome ||
                  t('initiativeAgreement:history.notReviewed')}
              </BCTypography>
              {requirement.analyst_review && (
                <BCTypography variant="body4" component="p">
                  {requirement.analyst_review}
                </BCTypography>
              )}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

const EntryDetail = ({ entry }) => {
  const { t } = useTranslation(['initiativeAgreement'])
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
  if (entry.status?.status && entry.event === 'STATUS_CHANGE') {
    lines.push(
      t('initiativeAgreement:history.movedTo', { status: entry.status.status })
    )
  }

  return (
    <>
      {lines.map((line) => (
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
      {Array.isArray(snapshot.evidence_requirements) &&
        snapshot.evidence_requirements.length > 0 && (
          <EvidenceDetail requirements={snapshot.evidence_requirements} />
        )}
    </>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {entries.map((entry) => (
              <Paper
                key={entry.designatedActionHistoryId}
                variant="outlined"
                data-test={`history-entry-${entry.designatedActionHistoryId}`}
                sx={{
                  p: 2,
                  borderLeft: 4,
                  borderLeftColor: railColour(entry.event)
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                    alignItems: 'baseline'
                  }}
                >
                  <BCTypography variant="body4" sx={{ fontWeight: 700 }}>
                    {t(
                      `initiativeAgreement:history.events.${
                        EVENT_LABELS[entry.event] || 'unknown'
                      }`
                    )}
                  </BCTypography>
                  <BCTypography variant="body4" color="text.secondary">
                    {[
                      entry.displayName,
                      timezoneFormatter({ value: entry.createDate })
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </BCTypography>
                </Box>
                <EntryDetail entry={entry} />
              </Paper>
            ))}
          </Box>
        )}
      </Collapse>
    </BCBox>
  )
}

export default DesignatedActionHistoryPanel
