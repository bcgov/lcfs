import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link as MuiLink,
  CircularProgress,
} from '@mui/material'
import { ArrowForward, Close, InfoOutlined, WarningAmberOutlined } from '@mui/icons-material'
import { Link as RouterLink } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import BCBox from '@/components/BCBox'
import BCBadge from '@/components/BCBadge'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCUserInitials from '@/components/BCUserInitials/BCUserInitials'
import { ROUTES } from '@/routes/routes'
import { useTargetUserNotificationSubscriptions } from '@/hooks/useNotifications'
import { useUserAssignedWork } from '@/hooks/useUser'
import { roles } from '@/constants/roles'
import {
  ROLE_NOTIF_TYPES,
  NOTIF_TYPE_CONFIG,
  ROLE_ACCESS
} from '@/constants/notificationCategories'
import colors from '@/themes/base/colors'

const BASE_ROLES = [roles.government.toLowerCase(), roles.supplier.toLowerCase()]
const displayName = (r) => Object.values(roles).find((v) => v.toLowerCase() === r) ?? r

const RoleBadge = ({ role, isGovUser, variant = 'outlined' }) => (
  <BCBadge
    badgeContent={displayName(role)}
    color={isGovUser ? 'primary' : 'secondary'}
    variant={variant}
    size="sm"
    sx={{
      '& .MuiBadge-badge': {
        fontWeight: 'regular',
        fontSize: '0.8125rem',
        padding: '0.4em 0.6em'
      },
      margin: '2px'
    }}
  />
)

const StatusBadge = ({ isActive }) => (
  <BCBadge
    badgeContent={isActive ? 'Active' : 'Inactive'}
    color={isActive ? 'success' : 'error'}
    variant="contained"
    size="md"
    sx={{
      '& .MuiBadge-badge': {
        minWidth: '120px',
        fontWeight: 'regular',
        textTransform: 'capitalize',
        fontSize: '0.875rem',
        padding: '0.4em 0.6em'
      }
    }}
  />
)

const assignedWorkStatusStyle = (status) => {
  const normalizedStatus = status?.toLowerCase()
  if (normalizedStatus === 'draft') {
    return { background: colors.grey[200], color: colors.grey[800] }
  }
  if (normalizedStatus === 'submitted') {
    return {
      background: colors.alerts.info.background,
      color: colors.alerts.info.color
    }
  }
  if (
    ['recommended', 'changes requested', 'supplemental requested'].includes(
      normalizedStatus
    )
  ) {
    return {
      background: colors.alerts.warning.background,
      color: colors.alerts.warning.color
    }
  }
  if (
    ['approved', 'completed', 'assessed', 'exempted'].includes(normalizedStatus)
  ) {
    return {
      background: colors.alerts.success.background,
      color: colors.alerts.success.color
    }
  }
  if (['withdrawn', 'rejected'].includes(normalizedStatus)) {
    return {
      background: colors.alerts.error.background,
      color: colors.alerts.error.color
    }
  }
  return { background: colors.grey[200], color: colors.grey[800] }
}

export const UserImpactSummaryModal = ({
  open,
  onClose,
  onConfirm,
  currentUserData,
  proposedRoles,
  proposedIsActive,
  isNewUser,
  userId,
  isCurrentUserGovernment = false
}) => {
  const { t } = useTranslation(['common', 'admin', 'notifications'])

  const isGovUser =
    currentUserData?.isGovernmentUser ??
    proposedRoles.some((r) => r.toLowerCase() === roles.government.toLowerCase())

  const {
    data: userSubscriptions = [],
    isFetching: isSubscriptionsLoading
  } = useTargetUserNotificationSubscriptions(
    open && !isNewUser && isCurrentUserGovernment ? userId : null
  )

  const {
    data: _assignedWorkRaw,
    isFetching: isAssignedWorkLoading,
    isError: isAssignedWorkError
  } = useUserAssignedWork(
    open && !isNewUser && isCurrentUserGovernment ? userId : null
  )

  const assignedWork = _assignedWorkRaw
    ? {
        complianceReports: Array.isArray(_assignedWorkRaw.complianceReports)
          ? _assignedWorkRaw.complianceReports
          : [],
        ciApplications: Array.isArray(_assignedWorkRaw.ciApplications)
          ? _assignedWorkRaw.ciApplications
          : []
      }
    : { complianceReports: [], ciApplications: [] }

  const impact = useMemo(() => {
    if (!open) return null

    const strip = (list) => list.filter((r) => r && !BASE_ROLES.includes(r))
    const currentRoles = strip(currentUserData?.roles?.map((r) => r.name.toLowerCase()) ?? [])
    const newRoles = strip(proposedRoles.map((r) => r.toLowerCase()))

    const rolesAdded = newRoles.filter((r) => !currentRoles.includes(r))
    const rolesRemoved = currentRoles.filter((r) => !newRoles.includes(r))
    const rolesKept = newRoles.filter((r) => currentRoles.includes(r))

    const currentIsActive = isNewUser ? true : (currentUserData?.isActive ?? true)
    const statusChanged = !isNewUser && currentIsActive !== proposedIsActive
    const isDeactivating = statusChanged && !proposedIsActive
    const analystRole = roles.analyst.toLowerCase()
    const losesAssignedWorkAccess =
      isDeactivating ||
      (currentRoles.includes(analystRole) && !newRoles.includes(analystRole))

    const coveredBy = (typeName, roleList) =>
      roleList.some((r) => ROLE_NOTIF_TYPES[r]?.has(typeName))

    const removedSubscriptions = userSubscriptions
      .filter(
        (subscription) =>
          subscription.isEnabled &&
          subscription.notificationTypeName &&
          subscription.notificationChannelName
      )
      .filter((subscription) => {
        const typeName = subscription.notificationTypeName
        const channelName = subscription.notificationChannelName

        if (!NOTIF_TYPE_CONFIG[typeName]) return false

        // IN_APP government notifications are not user-configurable; skip them
        if (channelName === 'IN_APP' && typeName.endsWith('__GOVERNMENT_NOTIFICATION')) {
          return false
        }

        if (isDeactivating) return true

        return (
          coveredBy(typeName, rolesRemoved) &&
          !coveredBy(typeName, [...rolesKept, ...rolesAdded])
        )
      })

    const notifsLost = Object.values(
      removedSubscriptions.reduce((grouped, subscription) => {
        const typeName = subscription.notificationTypeName
        const [categoryKey, labelKey, categoryOrder] = NOTIF_TYPE_CONFIG[typeName]
        const channel = subscription.notificationChannelName === 'IN_APP' ? 'In-app' : 'Email'

        if (!grouped[typeName]) {
          grouped[typeName] = {
            key: typeName,
            label: t(`notifications:${categoryKey}.${labelKey}`),
            categoryKey,
            category: t(`notifications:${categoryKey}.title`),
            categoryOrder,
            channels: []
          }
        }
        if (!grouped[typeName].channels.includes(channel)) {
          grouped[typeName].channels.push(channel)
        }
        return grouped
      }, {})
    )
      .map((subscription) => ({
        ...subscription,
        channels: subscription.channels.sort(
          (a, b) => (a === 'Email' ? -1 : 1) - (b === 'Email' ? -1 : 1)
        )
      }))
      .sort(
        (a, b) =>
          a.categoryOrder - b.categoryOrder ||
          a.label.localeCompare(b.label)
      )

    const notifGroups = Object.values(
      notifsLost.reduce((grouped, subscription) => {
        if (!grouped[subscription.categoryKey]) {
          grouped[subscription.categoryKey] = {
            key: subscription.categoryKey,
            label: subscription.category,
            order: subscription.categoryOrder,
            subscriptions: []
          }
        }
        grouped[subscription.categoryKey].subscriptions.push(subscription)
        return grouped
      }, {})
    ).sort((a, b) => a.order - b.order)

    return {
      currentRoles,
      newRoles,
      rolesAdded,
      rolesRemoved,
      rolesKept,
      notifsLost,
      notifGroups,
      statusChanged,
      currentIsActive,
      isDeactivating,
      losesAssignedWorkAccess,
      hasRoleChanges: rolesAdded.length > 0 || rolesRemoved.length > 0,
      hasNotifChanges: notifGroups.length > 0
    }
  }, [open, currentUserData, proposedRoles, proposedIsActive, isNewUser, userSubscriptions, t])

  if (!impact) return null

  const firstName = currentUserData?.firstName ?? ''
  const lastName = currentUserData?.lastName ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  const hasAnyChange = impact.statusChanged || impact.hasRoleChanges
  const hasAssignedWork =
    assignedWork.complianceReports.length > 0 ||
    assignedWork.ciApplications.length > 0
  const isImpactDataLoading =
    !isNewUser && (isSubscriptionsLoading || isAssignedWorkLoading)
  const showRoleImpact = impact.statusChanged || impact.hasRoleChanges
  const showNotificationImpact = impact.hasNotifChanges
  const showAssignedWorkImpact = impact.losesAssignedWorkAccess && isGovUser
  const impactColumnCount =
    [showRoleImpact, showNotificationImpact, showAssignedWorkImpact].filter(Boolean).length || 1
  const dialogMaxWidth =
    impactColumnCount === 3
      ? '1500px'
      : impactColumnCount === 2
        ? '1000px'
        : '650px'
  const impactPanelSx = {
    minWidth: 0,
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    p: 2,
    bgcolor: colors.background.default,
    border: `1px solid ${colors.grey[300]}`,
    borderRadius: 1.5,
    boxShadow: '0 2px 8px rgba(0, 51, 102, 0.08)'
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      aria-labelledby="impact-modal-title"
      disableRestoreFocus={false}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 3 }}
      slotProps={{
        paper: {
          sx: {
            width: 'calc(100vw - 48px)',
            maxWidth: dialogMaxWidth,
            maxHeight: 'calc(100vh - 48px)'
          }
        }
      }}
    >
      <DialogTitle id="impact-modal-title" sx={{ px: 3, py: 1.5, pr: 6 }}>
        {isNewUser ? t('admin:impactModal.titleNew') : t('admin:impactModal.titleEdit')}
      </DialogTitle>

      <IconButton
        aria-label={t('common:close')}
        onClick={onClose}
        data-test="impact-modal-close-btn"
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: 'white',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' }
        }}
      >
        <Close sx={{ color: '#fff' }} />
      </IconButton>

      <DialogContent sx={{ p: 0 }}>
        {fullName && (
          <BCBox
            display="flex"
            alignItems="center"
            gap={2}
            px={3}
            py={2}
            sx={{
              bgcolor: colors.background.grey,
              borderBottom: `1px solid ${colors.grey[300]}`
            }}
          >
            <BCUserInitials
              fullName={fullName}
              variant="filled"
              color="primary"
              sx={{
                height: '40px',
                width: '40px',
                minWidth: '40px',
                borderRadius: '50%',
                fontSize: '1rem',
                '& .MuiChip-label': { padding: 0 }
              }}
            />
            <BCTypography variant="label" component="div">
              {fullName}
            </BCTypography>
          </BCBox>
        )}

        {isImpactDataLoading ? (
          <BCBox
            role="status"
            aria-live="polite"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap={1.5}
            sx={{ minHeight: '260px' }}
          >
            <CircularProgress size={28} thickness={4} />
            <BCTypography variant="body2" color="text.secondary">
              Loading change impacts…
            </BCTypography>
          </BCBox>
        ) : (
          <BCBox px={3} py={2.5}>
            <BCBox
              display="grid"
              sx={{
                gridTemplateColumns: {
                  xs: '1fr',
                  md: `repeat(${impactColumnCount}, minmax(0, 1fr))`
                },
                gap: 2.5,
                alignItems: 'stretch',
                p: 2.5,
                bgcolor: colors.grey[100],
                borderRadius: 1.5
              }}
            >
              {showRoleImpact && (
                <BCBox sx={{ ...impactPanelSx, borderTop: `3px solid ${colors.primary.main}` }}>
                  {impact.statusChanged && (
                    <BCBox mb={2.5}>
                      <BCTypography variant="label" component="div" mb={1.25}>
                        Account status
                      </BCTypography>
                      <BCBox display="flex" alignItems="center" gap={1.5}>
                        <StatusBadge isActive={impact.currentIsActive} />
                        <ArrowForward sx={{ fontSize: 18, color: colors.grey[500] }} />
                        <StatusBadge isActive={proposedIsActive} />
                      </BCBox>
                    </BCBox>
                  )}

                  {impact.statusChanged && impact.hasRoleChanges && <Divider sx={{ mb: 2.5 }} />}

                  {impact.hasRoleChanges && (
                    <BCBox display="flex" flexDirection="column" sx={{ flex: 1 }}>
                      <BCTypography variant="label" component="div" mb={1.25}>
                        Role changes
                      </BCTypography>

                      {impact.rolesAdded.length > 0 && (
                        <BCBox mb={1.5}>
                          <BCTypography
                            variant="body3"
                            fontWeight="medium"
                            component="div"
                            sx={{ color: colors.success.main, mb: 0.75, fontSize: '0.8125rem' }}
                          >
                            Roles being added
                          </BCTypography>
                          <BCBox
                            sx={{
                              border: `1px solid ${colors.grey[300]}`,
                              borderLeft: `3px solid ${colors.success.main}`,
                              borderRadius: '0 4px 4px 0',
                              overflow: 'hidden'
                            }}
                          >
                            {impact.rolesAdded.map((role, i) => (
                              <BCBox
                                key={role}
                                display="grid"
                                sx={{
                                  gridTemplateColumns: '1fr',
                                  gap: 0.5,
                                  px: 2,
                                  py: 1.25,
                                  borderBottom:
                                    i < impact.rolesAdded.length - 1
                                      ? `1px solid ${colors.grey[300]}`
                                      : 'none',
                                  bgcolor: colors.alerts.success.background,
                                  alignItems: 'start'
                                }}
                              >
                                <BCBox>
                                  <RoleBadge role={role} isGovUser={isGovUser} variant="contained" />
                                </BCBox>
                                {ROLE_ACCESS[role] && (
                                  <BCTypography
                                    variant="body3"
                                    color="text.secondary"
                                    sx={{ pl: 0.25, lineHeight: 1.5 }}
                                  >
                                    {ROLE_ACCESS[role]}
                                  </BCTypography>
                                )}
                              </BCBox>
                            ))}
                          </BCBox>
                        </BCBox>
                      )}

                      {impact.rolesRemoved.length > 0 && (
                        <BCBox mb={1.5}>
                          <BCTypography
                            variant="body3"
                            fontWeight="medium"
                            component="div"
                            sx={{ color: colors.error.main, mb: 0.75, fontSize: '0.8125rem' }}
                          >
                            Roles being removed
                          </BCTypography>
                          <BCBox
                            sx={{
                              border: `1px solid ${colors.grey[300]}`,
                              borderLeft: `3px solid ${colors.error.main}`,
                              borderRadius: '0 4px 4px 0',
                              overflow: 'hidden'
                            }}
                          >
                            {impact.rolesRemoved.map((role, i) => (
                              <BCBox
                                key={role}
                                display="grid"
                                sx={{
                                  gridTemplateColumns: '1fr',
                                  gap: 0.5,
                                  px: 2,
                                  py: 1.25,
                                  borderBottom:
                                    i < impact.rolesRemoved.length - 1
                                      ? `1px solid ${colors.grey[300]}`
                                      : 'none',
                                  bgcolor: colors.alerts.error.background,
                                  alignItems: 'start'
                                }}
                              >
                                <BCBox>
                                  <RoleBadge role={role} isGovUser={isGovUser} />
                                </BCBox>
                                {ROLE_ACCESS[role] && (
                                  <BCTypography
                                    variant="body3"
                                    color="text.secondary"
                                    sx={{ pl: 0.25, lineHeight: 1.5 }}
                                  >
                                    {ROLE_ACCESS[role]}
                                  </BCTypography>
                                )}
                              </BCBox>
                            ))}
                          </BCBox>
                        </BCBox>
                      )}

                      {impact.rolesKept.length > 0 && (
                        <BCBox mt="auto" pt={2}>
                          <BCBox
                            display="flex"
                            alignItems="center"
                            gap={1}
                            flexWrap="wrap"
                            pt={1.5}
                            sx={{
                              borderTop: `1px solid ${colors.grey[400]}`,
                              minHeight: '64px',
                              boxSizing: 'border-box'
                            }}
                          >
                            <BCTypography variant="body3" color="text.secondary">
                              Unchanged:
                            </BCTypography>
                            {impact.rolesKept.map((r) => (
                              <RoleBadge key={r} role={r} isGovUser={isGovUser} />
                            ))}
                          </BCBox>
                        </BCBox>
                      )}
                    </BCBox>
                  )}
                </BCBox>
              )}

              {showNotificationImpact && (
                <BCBox sx={{ ...impactPanelSx, borderTop: `3px solid ${colors.error.main}` }}>
                  {impact.hasNotifChanges && (
                    <BCBox display="flex" flexDirection="column" sx={{ flex: 1 }}>
                      <BCTypography variant="label" component="div" mb={1.25}>
                        Subscriptions that will be removed
                      </BCTypography>

                      {impact.notifGroups.map((group, groupIndex) => (
                        <BCBox
                          key={group.key}
                          mb={groupIndex < impact.notifGroups.length - 1 ? 1.5 : 0}
                        >
                          <BCTypography
                            variant="body3"
                            sx={{ display: 'block', fontWeight: 600, mb: 0.75 }}
                          >
                            {group.label}
                          </BCTypography>
                          <BCBox
                            sx={{
                              border: `1px solid ${colors.grey[300]}`,
                              borderRadius: 1,
                              overflow: 'hidden'
                            }}
                          >
                            {group.subscriptions.map((subscription, index) => (
                              <BCBox
                                key={subscription.key}
                                display="flex"
                                alignItems="center"
                                gap={1.25}
                                sx={{
                                  px: 2,
                                  py: 0.875,
                                  borderBottom:
                                    index < group.subscriptions.length - 1
                                      ? `1px solid ${colors.grey[300]}`
                                      : 'none',
                                  bgcolor: colors.alerts.error.background
                                }}
                              >
                                <BCTypography
                                  variant="body3"
                                  sx={{
                                    color: colors.error.main,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                    minWidth: 12
                                  }}
                                >
                                  −
                                </BCTypography>
                                <BCTypography variant="body3" sx={{ flex: 1 }}>
                                  {subscription.label}
                                </BCTypography>
                                <BCTypography
                                  variant="body3"
                                  color="text.secondary"
                                  sx={{ flexShrink: 0 }}
                                >
                                  {subscription.channels.join(' · ')}
                                </BCTypography>
                              </BCBox>
                            ))}
                          </BCBox>
                        </BCBox>
                      ))}

                      <BCBox mt="auto" pt={2}>
                        <BCBox
                          display="flex"
                          alignItems="flex-start"
                          gap={0.75}
                          pt={1.5}
                          sx={{
                            borderTop: `1px solid ${colors.grey[400]}`,
                            minHeight: '64px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <InfoOutlined sx={{ fontSize: 14, color: colors.text.secondary, mt: '4px', flexShrink: 0 }} />
                          <BCTypography variant="body3" color="text.secondary">
                            These are subscriptions the user currently has enabled that will be removed by this change.
                          </BCTypography>
                        </BCBox>
                      </BCBox>
                    </BCBox>
                  )}
                </BCBox>
              )}

              {showAssignedWorkImpact && (
                <BCBox sx={{ ...impactPanelSx, borderTop: `3px solid ${colors.warning.main}` }}>
                  {impact.losesAssignedWorkAccess && (
                    <BCBox display="flex" flexDirection="column" sx={{ flex: 1 }}>
                      <BCTypography variant="label" component="div" mb={1.25}>
                        Assigned work affected
                      </BCTypography>

                      {isAssignedWorkLoading && (
                        <BCTypography variant="body3" color="text.secondary">
                          Checking assigned work…
                        </BCTypography>
                      )}

                      {isAssignedWorkError && (
                        <BCTypography variant="body3" sx={{ color: colors.error.main }}>
                          Assigned work could not be loaded. Review assignments before confirming.
                        </BCTypography>
                      )}

                      {!isAssignedWorkLoading && !isAssignedWorkError && !hasAssignedWork && (
                        <BCTypography variant="body3" color="text.secondary">
                          No active compliance reports or CI applications are assigned to this user.
                        </BCTypography>
                      )}

                      {!isAssignedWorkLoading && assignedWork.complianceReports.length > 0 && (
                        <BCBox mb={assignedWork.ciApplications.length > 0 ? 1.5 : 0}>
                          <BCTypography
                            variant="body3"
                            sx={{ fontWeight: 600, color: colors.text.secondary, mb: 0.75, display: 'block' }}
                          >
                            Compliance reports ({assignedWork.complianceReports.length})
                          </BCTypography>
                          <BCBox
                            sx={{
                              border: `1px solid ${colors.grey[300]}`,
                              borderRadius: 1,
                              overflow: 'hidden'
                            }}
                          >
                            {assignedWork.complianceReports.map((r, i) => (
                              <BCBox
                                key={r.complianceReportId}
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                                gap={1}
                                sx={{
                                  px: 2,
                                  py: 1,
                                  borderBottom:
                                    i < assignedWork.complianceReports.length - 1
                                      ? `1px solid ${colors.grey[300]}`
                                      : 'none',
                                  bgcolor: colors.grey[100]
                                }}
                              >
                                <BCBox>
                                  <MuiLink
                                    component={RouterLink}
                                    to={ROUTES.REPORTS.VIEW
                                      .replace(':compliancePeriod', r.period)
                                      .replace(':complianceReportId', String(r.complianceReportId))}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ fontWeight: 600, fontSize: '0.8125rem', color: colors.link.main }}
                                  >
                                    {r.organization} | {r.period}
                                  </MuiLink>
                                </BCBox>
                                <BCBadge
                                  badgeContent={r.status}
                                  color="info"
                                  variant="contained"
                                  size="xs"
                                  sx={{
                                    flexShrink: 0,
                                    '& .MuiBadge-badge': {
                                      padding: '0.3em 0.6em',
                                      fontWeight: 600,
                                      fontSize: '0.72rem',
                                      minWidth: '88px',
                                      whiteSpace: 'nowrap',
                                      ...assignedWorkStatusStyle(r.status)
                                    }
                                  }}
                                />
                              </BCBox>
                            ))}
                          </BCBox>
                        </BCBox>
                      )}

                      {!isAssignedWorkLoading && assignedWork.ciApplications.length > 0 && (
                        <BCBox>
                          <BCTypography
                            variant="body3"
                            sx={{ fontWeight: 600, color: colors.text.secondary, mb: 0.75, display: 'block' }}
                          >
                            CI applications ({assignedWork.ciApplications.length})
                          </BCTypography>
                          <BCBox
                            sx={{
                              border: `1px solid ${colors.grey[300]}`,
                              borderRadius: 1,
                              overflow: 'hidden'
                            }}
                          >
                            {assignedWork.ciApplications.map((app, i) => (
                              <BCBox
                                key={app.ciApplicationId}
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                                gap={1}
                                sx={{
                                  px: 2,
                                  py: 1,
                                  borderBottom:
                                    i < assignedWork.ciApplications.length - 1
                                      ? `1px solid ${colors.grey[300]}`
                                      : 'none',
                                  bgcolor: colors.grey[100]
                                }}
                              >
                                <BCBox>
                                  <MuiLink
                                    component={RouterLink}
                                    to={ROUTES.CI_APPLICATIONS.EDIT.replace(
                                      ':ciApplicationId',
                                      String(app.ciApplicationId)
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ fontWeight: 600, fontSize: '0.8125rem', color: colors.link.main }}
                                  >
                                    {app.organization}
                                  </MuiLink>
                                </BCBox>
                                <BCBadge
                                  badgeContent={app.status}
                                  color="info"
                                  variant="contained"
                                  size="xs"
                                  sx={{
                                    flexShrink: 0,
                                    '& .MuiBadge-badge': {
                                      padding: '0.3em 0.6em',
                                      fontWeight: 600,
                                      fontSize: '0.72rem',
                                      minWidth: '88px',
                                      whiteSpace: 'nowrap',
                                      ...assignedWorkStatusStyle(app.status)
                                    }
                                  }}
                                />
                              </BCBox>
                            ))}
                          </BCBox>
                        </BCBox>
                      )}

                      {!isAssignedWorkLoading && hasAssignedWork && (
                        <BCBox mt="auto" pt={2}>
                          <BCBox
                            display="flex"
                            alignItems="flex-start"
                            gap={0.75}
                            pt={1.5}
                            sx={{
                              borderTop: `1px solid ${colors.grey[400]}`,
                              minHeight: '64px',
                              boxSizing: 'border-box'
                            }}
                          >
                            <WarningAmberOutlined sx={{ fontSize: 14, color: colors.warning.main, mt: '4px', flexShrink: 0 }} />
                            <BCTypography variant="body3" color="text.secondary">
                              This user will lose access to these assigned items. Reassign them after saving.
                            </BCTypography>
                          </BCBox>
                        </BCBox>
                      )}
                    </BCBox>
                  )}
                </BCBox>
              )}

              {impact.isDeactivating && (
                <BCBox
                  role="alert"
                  display="flex"
                  gap={1.25}
                  sx={{
                    p: 1.5,
                    bgcolor: colors.alerts.warning.background,
                    borderLeft: `4px solid ${colors.warning.main}`,
                    borderRadius: '0 4px 4px 0',
                    gridColumn: '1 / -1'
                  }}
                >
                  <WarningAmberOutlined
                    sx={{ fontSize: 18, color: colors.warning.main, flexShrink: 0, mt: '4px' }}
                  />
                  <BCTypography
                    variant="body3"
                    sx={{ color: colors.alerts.warning.color, lineHeight: 1.6 }}
                  >
                    <strong>Deactivating this account</strong> will remove all notification
                    subscriptions and prevent access to assigned work.
                  </BCTypography>
                </BCBox>
              )}

              {!hasAnyChange && !isNewUser && (
                <BCBox
                  display="flex"
                  gap={0.75}
                  alignItems="flex-start"
                  sx={{ gridColumn: '1 / -1' }}
                >
                  <InfoOutlined sx={{ fontSize: 15, color: colors.info.main, mt: '2px' }} />
                  <BCTypography variant="body3" color="text.secondary">
                    No role or status changes. Only profile information will be updated.
                  </BCTypography>
                </BCBox>
              )}
            </BCBox>
          </BCBox>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <BCButton
          variant="outlined"
          color="primary"
          onClick={onClose}
          data-test="impact-modal-back-btn"
          sx={{ backgroundColor: 'white.main' }}
        >
          {t('admin:impactModal.backBtn')}
        </BCButton>
        <BCButton
          variant="contained"
          color="primary"
          onClick={onConfirm}
          autoFocus
          data-test="impact-modal-confirm-btn"
        >
          {isNewUser ? t('admin:impactModal.confirmBtnNew') : t('admin:impactModal.confirmBtnEdit')}
        </BCButton>
      </DialogActions>
    </Dialog>
  )
}

UserImpactSummaryModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  currentUserData: PropTypes.object,
  proposedRoles: PropTypes.arrayOf(PropTypes.string).isRequired,
  proposedIsActive: PropTypes.bool.isRequired,
  isNewUser: PropTypes.bool,
  userId: PropTypes.number,
  isCurrentUserGovernment: PropTypes.bool
}

UserImpactSummaryModal.defaultProps = {
  isNewUser: false,
  currentUserData: null,
  isCurrentUserGovernment: false
}

export default UserImpactSummaryModal
