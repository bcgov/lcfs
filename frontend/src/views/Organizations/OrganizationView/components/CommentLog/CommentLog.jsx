import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  CircularProgress,
  GlobalStyles,
  Skeleton,
  Stack
} from '@mui/material'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import { BCPagination } from '@/components/BCDataGrid/components'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useOrganizationComments,
  useCommentCategories,
  useEditOrganizationComment
} from '@/hooks/useOrganizationComments'

import { CommentRow } from './CommentRow'
import { CommentLogFilters } from './CommentLogFilters'

// 10 years rolling window — matches what supply history uses.
const buildYearOptions = () => {
  const currentYear = new Date().getFullYear()
  const out = []
  for (let y = currentYear; y >= currentYear - 10; y -= 1) out.push(y)
  return out
}

const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100]

const getCommentEntityKey = (comment) => {
  if (!comment?.entityType || !comment?.entityId) return null
  return `${comment.entityType}:${comment.entityId}`
}

// Groups consecutive comments that share the same entity key into threads.
// No reordering — the backend already clusters same-entity comments together.
const groupConsecutiveByEntity = (comments) => {
  const groups = []
  comments.forEach((comment) => {
    const key = getCommentEntityKey(comment)
    const last = groups[groups.length - 1]
    if (last && last.entityKey === key && key !== null) {
      last.comments.push(comment)
    } else {
      groups.push({ entityKey: key, comments: [comment] })
    }
  })
  return groups
}

const LoadingSkeleton = () => (
  <Stack spacing={1.5} aria-busy="true" data-test="comment-log-loading">
    {[0, 1, 2].map((i) => (
      <Box key={i} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="65%" />
      </Box>
    ))}
  </Stack>
)

/** Comment Log for an organization — server-paginated, filter-capable. */
export const CommentLog = ({ organizationId }) => {
  const { t } = useTranslation(['internalComment'])
  const { orgID } = useParams()
  const { hasRoles, data: currentUser } = useCurrentUser()
  const isGovernment = hasRoles(roles.government)

  const effectiveOrgId =
    organizationId ?? orgID ?? currentUser?.organization?.organizationId

  const {
    filters,
    setFilter,
    setFilters,
    clearFilters,
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch
  } = useOrganizationComments(effectiveOrgId)

  const comments = data?.comments ?? []
  const threadGroups = useMemo(
    () => groupConsecutiveByEntity(comments),
    [comments]
  )
  const pagination = data?.pagination
  const total = pagination?.total ?? 0

  const yearOptions = useMemo(buildYearOptions, [])
  const { data: categoryOptions = [] } = useCommentCategories()
  const editMutation = useEditOrganizationComment(effectiveOrgId)

  return (
    <BCBox component="section" aria-label={t('internalComment:log.title')}>
      {/* Mirrors styling used by the canonical CommentList component. */}
      <GlobalStyles
        styles={{
          '.comment-content': {
            wordBreak: 'break-word',
            fontSize: '1rem',
            lineHeight: 1.5
          },
          '.comment-content p': { margin: '0.25rem 0' },
          '.comment-content ul, .comment-content ol': {
            paddingLeft: '1.5rem',
            margin: '0.25rem 0'
          }
        }}
      />
      <Stack spacing={2}>
        <CommentLogFilters
          filters={filters}
          setFilter={setFilter}
          clearFilters={clearFilters}
          categories={categoryOptions}
          years={yearOptions}
        />

        {isLoading && <LoadingSkeleton />}

        {!isLoading && isError && (
          <Alert
            severity="error"
            data-test="comment-log-error"
            action={
              <BCButton
                size="small"
                color="error"
                variant="outlined"
                onClick={() => refetch()}
              >
                {t('internalComment:log.retry')}
              </BCButton>
            }
          >
            {t('internalComment:log.errorTitle')}
            {error instanceof Error && error.message
              ? `: ${error.message}`
              : ''}
          </Alert>
        )}

        {!isLoading && !isError && comments.length === 0 && (
          <Alert severity="info" icon={false} data-test="comment-log-empty">
            {t('internalComment:log.empty')}
          </Alert>
        )}

        {comments.length > 0 && (
          <BCBox
            variant="bordered"
            borderRadius="sm"
            data-test="comment-log-list"
            sx={{
              p: 2,
              backgroundColor: '#ffffff',
              opacity: isFetching ? 0.7 : 1,
              transition: 'opacity 150ms'
            }}
          >
            <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {threadGroups.map(
                ({ entityKey, comments: threadComments }, groupIdx) => {
                  const isThread = threadComments.length > 1
                  const groupKey =
                    entityKey ?? `single-${threadComments[0].internalCommentId}`

                  return (
                    <Box
                      key={groupKey}
                      component="li"
                      sx={{
                        listStyle: 'none',
                        mb: isThread ? 2 : 0,
                        ...(isThread && {
                          borderLeft: '4px solid',
                          borderColor: 'primary.light',
                          borderRadius: '0 4px 4px 0',
                          backgroundColor: 'rgba(0, 0, 0, 0.075)'
                        })
                      }}
                    >
                      {threadComments.map((c) => (
                        <Box
                          key={c.internalCommentId}
                          data-test={`comment-log-item-${c.internalCommentId}`}
                        >
                          <CommentRow
                            comment={c}
                            index={groupIdx}
                            showInternalBadge={isGovernment}
                            isGovernmentUser={isGovernment}
                            onEdit={(commentId, comment, visibility) =>
                              editMutation.mutate({
                                commentId,
                                comment,
                                visibility
                              })
                            }
                            isEditPending={editMutation.isPending}
                          />
                        </Box>
                      ))}
                    </Box>
                  )
                }
              )}
            </Box>
          </BCBox>
        )}

        {total > 0 && (
          <BCBox
            className="ag-grid-pagination-container"
            display="flex"
            justifyContent="flex-start"
            variant="outlined"
            sx={{
              maxHeight: '3.5rem',
              position: 'relative',
              border: 'none !important'
            }}
            data-test="comment-log-pagination"
          >
            <BCPagination
              total={total}
              page={filters.page}
              size={filters.size}
              handleChangePage={(_, zeroBasedPage) =>
                setFilters({ page: zeroBasedPage + 1 })
              }
              handleChangeRowsPerPage={(event) =>
                setFilters({ size: Number(event.target.value), page: 1 })
              }
            />
            {isFetching && (
              <CircularProgress
                size={18}
                aria-label={t('internalComment:log.loading')}
                sx={{ alignSelf: 'center', ml: 1 }}
              />
            )}
          </BCBox>
        )}
      </Stack>
    </BCBox>
  )
}

// Surfaces the canonical page-size options for tests/consumers.
CommentLog.PAGE_SIZE_OPTIONS = PAGE_SIZE_OPTIONS
