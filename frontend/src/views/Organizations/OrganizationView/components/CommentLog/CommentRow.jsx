import { forwardRef, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Avatar,
  Chip,
  FormControlLabel,
  Radio,
  RadioGroup,
  Tooltip
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import CommentForm from '@/components/Comments/CommentForm'

import { sanitizeCommentHtml } from './sanitize'
import { formatCommentDateTime, isCommentEdited } from './dateUtils'

const ENTITY_TYPE_CONFIG = {
  Transfer: {
    label: 'Transfer',
    path: (id) => `/transfers/${id}`
  },
  initiativeAgreement: {
    label: 'IA',
    path: (id) => `/initiative-agreement/${id}`
  },
  administrativeAdjustment: {
    label: 'Admin Adj',
    path: (id) => `/admin-adjustment/${id}`
  },
  complianceReport: {
    label: 'CR',
    path: (id, year) => `/compliance-reporting/${year}/${id}`
  },
  Assessment: {
    label: 'Assessment',
    path: (id, year) => `/compliance-reporting/${year}/${id}`
  },
  ciApplication: {
    label: 'CI App',
    path: (id) => `/fuel-codes/${id}`
  }
}

const getEntityLink = (comment) => {
  const cfg = ENTITY_TYPE_CONFIG[comment.entityType]
  if (!cfg || !comment.entityId) return null
  return {
    label: `${cfg.label} #${comment.entityId}`,
    to: cfg.path(comment.entityId, comment.complianceYear)
  }
}

const getInitials = (name) => {
  if (!name) return ''
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

/**
 * Comment Log row with sanitized HTML body and optional inline editing.
 */
export const CommentRow = forwardRef(function CommentRow(
  {
    comment,
    index,
    showInternalBadge,
    isGovernmentUser,
    onEdit,
    isEditPending
  },
  ref
) {
  const { t } = useTranslation(['internalComment'])
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editVisibility, setEditVisibility] = useState('Internal')

  const startEdit = () => {
    setEditText(comment.comment ?? '')
    setEditVisibility(comment.visibility ?? 'Internal')
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const submitEdit = () => {
    onEdit?.(comment.internalCommentId, editText, editVisibility)
    setEditing(false)
  }

  const sanitizedHtml = useMemo(
    () => sanitizeCommentHtml(comment.comment),
    [comment.comment]
  )

  const edited = isCommentEdited(comment.createDate, comment.updateDate)
  const isInternal = comment.visibility === 'Internal'
  const renderVisibilityChip =
    !!comment.visibility && (showInternalBadge || !isInternal)

  const editedLabel = comment.updateDate
    ? t('internalComment:log.editedOn', {
        date: formatCommentDateTime(comment.updateDate)
      })
    : ''

  return (
    <BCBox
      ref={ref}
      component="article"
      data-test="comment-log-row"
      tabIndex={-1}
      aria-labelledby={`comment-${comment.internalCommentId}-meta`}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        pl: 2,
        pr: 2,
        pt: 1.5,
        pb: 1.5,
        backgroundColor: index % 2 === 0 ? 'transparent' : '#ffffff',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '-2px'
        }
      }}
    >
      <Tooltip title={comment.fullName || ''} arrow>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: '0.75rem',
            fontWeight: 'bold',
            bgcolor: '#606060',
            mt: 2.5,
            mr: 2
          }}
          aria-label={`Comment by ${comment.fullName || comment.createUser || ''}`}
          role="img"
        >
          {getInitials(comment.fullName) || '?'}
        </Avatar>
      </Tooltip>
      <BCBox
        sx={{
          mr: 1,
          p: 1,
          pl: 0,
          borderBottom: '1px solid #666666',
          width: '100%'
        }}
      >
        <BCBox
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap'
          }}
        >
          <BCBox
            id={`comment-${comment.internalCommentId}-meta`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap'
            }}
          >
            {comment.category && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={comment.category}
                data-test="comment-category-chip"
                sx={{
                  height: 22,
                  bgcolor: 'primary.main',
                  color: '#fff',
                  borderColor: 'primary.main',
                  width: 'fit-content',
                  '& .MuiChip-label': {
                    px: 2,
                    fontSize: '0.86rem'
                  }
                }}
              />
            )}
            <BCTypography variant="body2" color="text" component="span">
              <strong>{comment.fullName || comment.createUser || '—'}</strong>
              {comment.createDate && (
                <>
                  {', '}
                  <time dateTime={comment.createDate}>
                    {formatCommentDateTime(comment.createDate)}
                  </time>
                </>
              )}
              {comment.organizationName && (
                <>
                  {' - '}
                  {isGovernmentUser && comment.organizationId ? (
                    <BCTypography
                      variant="body2"
                      component={Link}
                      to={`/organizations/${comment.organizationId}`}
                      sx={{ color: 'link.main' }}
                    >
                      {comment.organizationName}
                    </BCTypography>
                  ) : (
                    comment.organizationName
                  )}
                </>
              )}
              {(() => {
                const entity = getEntityLink(comment)
                return entity ? (
                  <>
                    {' - '}
                    <BCTypography
                      variant="body2"
                      component={Link}
                      to={entity.to}
                      sx={{ color: 'link.main' }}
                    >
                      {entity.label}
                    </BCTypography>
                  </>
                ) : null
              })()}
              {comment.canEdit && !editing && (
                <>
                  {' '}
                  <BCTypography
                    variant="body2"
                    component="a"
                    role="button"
                    tabIndex={0}
                    onClick={startEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        startEdit()
                      }
                    }}
                    sx={{
                      color: 'link.main',
                      cursor: 'pointer',
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    [Edit]
                  </BCTypography>
                </>
              )}
              {edited && (
                <>
                  {' - '}
                  <span
                    style={{ color: 'red' }}
                    data-test="comment-edited-indicator"
                  >
                    {t('internalComment:edited')}
                  </span>
                  <Tooltip title={editedLabel} arrow>
                    <span style={{ marginLeft: '4px' }}>
                      <InfoOutlinedIcon
                        fontSize="medium"
                        sx={{
                          ml: '1px',
                          verticalAlign: 'text-top',
                          transform: 'scale(0.8)'
                        }}
                        aria-label={editedLabel}
                        role="img"
                      />
                    </span>
                  </Tooltip>
                </>
              )}
            </BCTypography>
          </BCBox>
          <BCBox sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {renderVisibilityChip && (
              <Chip
                data-test={
                  isInternal ? 'comment-internal-badge' : 'comment-public-badge'
                }
                label={
                  isInternal
                    ? t('internalComment:internal')
                    : t('internalComment:public')
                }
                size="small"
                sx={{
                  color: '#fff',
                  bgcolor: isInternal ? '#063267' : '#187a11',
                  minWidth: 88,
                  height: 24,
                  '& .MuiChip-label': {
                    fontSize: '0.86rem',
                    fontWeight: 600
                  }
                }}
              />
            )}
          </BCBox>
        </BCBox>
        <div
          className="comment-content"
          data-test="comment-body"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
        {editing && (
          <>
            <BCBox sx={{ borderTop: '1px solid #ccc', mt: 2, mb: 1.5 }} />
            <BCBox
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: -1.5
              }}
            >
              <BCTypography variant="subtitle2">
                {t('internalComment:editComment')}
              </BCTypography>
              {showInternalBadge && (
                <BCBox sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Chip
                    size="small"
                    label={
                      editVisibility === 'Public'
                        ? t('internalComment:public')
                        : t('internalComment:internal')
                    }
                    sx={{
                      color: '#fff',
                      bgcolor:
                        editVisibility === 'Public' ? '#187a11' : '#063267',
                      height: 22,
                      '& .MuiChip-label': {
                        fontSize: '0.86rem',
                        fontWeight: 600
                      }
                    }}
                  />
                  <RadioGroup
                    row
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value)}
                    sx={{ columnGap: 1, alignItems: 'center' }}
                  >
                    <FormControlLabel
                      value="Internal"
                      control={<Radio size="small" sx={{ p: 0.25 }} />}
                      label={t('internalComment:internal')}
                      sx={{
                        m: 0,
                        '& .MuiFormControlLabel-label': { fontSize: '0.88rem' }
                      }}
                    />
                    <FormControlLabel
                      value="Public"
                      control={<Radio size="small" sx={{ p: 0.25 }} />}
                      label={t('internalComment:public')}
                      sx={{
                        m: 0,
                        '& .MuiFormControlLabel-label': { fontSize: '0.88rem' }
                      }}
                    />
                  </RadioGroup>
                </BCBox>
              )}
            </BCBox>
            <CommentForm
              commentText={editText}
              onSubmit={submitEdit}
              onCancel={cancelEdit}
              onCommentChange={setEditText}
              isEditing
              isSubmitting={isEditPending}
              showAddCommentBtn
              showTitle={false}
              showVisibilityToggle={false}
            />
          </>
        )}
      </BCBox>
    </BCBox>
  )
})
