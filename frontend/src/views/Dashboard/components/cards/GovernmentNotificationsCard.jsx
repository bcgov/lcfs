import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  Button,
  TextField,
  Stack,
  Link as MuiLink,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { GlobalStyles } from '@mui/system'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import DOMPurify from 'dompurify'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCButton from '@/components/BCButton'
import Loading from '@/components/Loading'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useCurrentGovernmentNotification,
  useUpdateGovernmentNotification,
  useDeleteGovernmentNotification
} from '@/hooks/useGovernmentNotification'
import { roles } from '@/constants/roles'
import { useSnackbar } from 'notistack'

// Map notification types to pill background colors (lighter, pastel)
const NOTIFICATION_PILL_COLORS = {
  Alert: '#ffe4d0', // very light orange/peach
  Outage: '#ffd4d4', // very light red/pink
  Deadline: '#d4f1ff', // very light blue
  General: '#d4f4d7' // very light green
}

// Map notification types to pill text/border colors
const NOTIFICATION_PILL_TEXT_COLORS = {
  Alert: '#ff9f6f', // soft orange
  Outage: '#d84a4a', // coral red
  Deadline: '#5eaed3', // medium blue
  General: '#6fbf73' // medium green
}

const CARD_TEST_ID = 'dashboard-government-notifications-card'

// Safely extract text content from HTML using DOMParser
// This avoids regex-based sanitization vulnerabilities (CodeQL: incomplete multi-character sanitization)
const getTextContent = (html) => {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

const sanitizeNotificationHtml = (html) => {
  if (!html) return ''
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^(?:https?:)/i,
    ALLOW_DATA_ATTR: false
  })
  const doc = new DOMParser().parseFromString(clean, 'text/html')
  doc.querySelectorAll('a[href]').forEach((anchor) => {
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noopener noreferrer')
  })
  return doc.body.innerHTML
}

const GovernmentNotificationsCard = () => {
  const { t } = useTranslation(['dashboard'])
  const { enqueueSnackbar } = useSnackbar()
  const { hasRoles } = useCurrentUser()
  const canEdit = hasRoles(roles.system_admin)

  const { data: notification, isLoading } = useCurrentGovernmentNotification()
  const updateMutation = useUpdateGovernmentNotification({
    onSuccess: (data) => {
      enqueueSnackbar(t('dashboard:governmentNotifications.updateSuccess'), {
        variant: 'success'
      })
      // Exit edit mode after the notification is successfully saved
      setIsEditing(false)
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message ||
          t('dashboard:governmentNotifications.updateError'),
        { variant: 'error' }
      )
    }
  })

  const deleteMutation = useDeleteGovernmentNotification({
    onSuccess: () => {
      enqueueSnackbar(t('dashboard:governmentNotifications.deleteSuccess'), {
        variant: 'success'
      })
      setShowDeleteDialog(false)
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message ||
          t('dashboard:governmentNotifications.deleteError'),
        { variant: 'error' }
      )
    }
  })

  const [isEditing, setIsEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [formData, setFormData] = useState({
    notification_title: '',
    notification_text: '',
    link_url: '',
    notification_type: 'General'
  })

  const handleEditClick = () => {
    if (notification) {
      setFormData({
        notification_title: notification.notificationTitle || '',
        notification_text: notification.notificationText || '',
        link_url: notification.linkUrl || '',
        notification_type: notification.notificationType || 'General'
      })
    } else {
      // Reset to default values when creating new
      setFormData({
        notification_title: '',
        notification_text: '',
        link_url: '',
        notification_type: 'General'
      })
    }
    setIsEditing(true)
    // Scroll to top of card when entering edit mode
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = () => {
    setShowConfirmDialog(true)
  }

  const handleSaveWithEmail = () => {
    updateMutation.mutate({ ...formData, send_email: true })
    setShowConfirmDialog(false)
  }

  const handleSaveWithoutEmail = () => {
    updateMutation.mutate({ ...formData, send_email: false })
    setShowConfirmDialog(false)
  }

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    deleteMutation.mutate()
  }

  const handleCancelDelete = () => {
    setShowDeleteDialog(false)
  }

  // Check if notification text is empty (ReactQuill returns HTML tags even when empty)
  const isNotificationTextEmpty = useMemo(() => {
    if (!formData.notification_text) return true
    const stripped = getTextContent(formData.notification_text).trim()
    return stripped === ''
  }, [formData.notification_text])

  const cardTitle = useMemo(() => {
    const type = isEditing
      ? formData.notification_type
      : notification?.notificationType
    return (
      t(`dashboard:governmentNotifications.titles.${type}`, {
        defaultValue: ''
      }) || t('dashboard:governmentNotifications.titles.General')
    )
  }, [notification?.notificationType, isEditing, formData.notification_type, t])

  const headerStyles = useMemo(() => {
    const type = isEditing
      ? formData.notification_type
      : notification?.notificationType
    const bgColor =
      NOTIFICATION_PILL_COLORS[type] || NOTIFICATION_PILL_COLORS.General
    const textColor =
      NOTIFICATION_PILL_TEXT_COLORS[type] ||
      NOTIFICATION_PILL_TEXT_COLORS.General

    return {
      backgroundColor: `${bgColor} !important`,
      '& h2': {
        color: '#000 !important',
        fontWeight: 'bold'
      }
    }
  }, [notification?.notificationType, isEditing, formData.notification_type])

  // Check if text needs truncation (1,000 characters)
  const needsTruncation = useMemo(() => {
    if (!notification?.notificationText) return false
    const textLength = getTextContent(notification.notificationText).length
    return textLength > 1000
  }, [notification?.notificationText])

  if (isLoading) {
    return (
      <BCWidgetCard
        component="div"
        data-test={CARD_TEST_ID}
        title={t('dashboard:governmentNotifications.titles.General')}
        content={
          <Loading
            message={t('dashboard:governmentNotifications.loadingMessage')}
          />
        }
      />
    )
  }

  // Don't show card if no notification exists and user cannot edit
  // This applies to BCeID users and IDIR Analysts
  if (!notification && !canEdit) {
    return null
  }

  const renderEditForm = () => {
    return (
      <Box sx={{ p: 2 }}>
        <GlobalStyles
          styles={{
            '.ql-editor': {
              minHeight: '120px',
              backgroundColor: '#fff'
            },
            '.ql-toolbar.ql-snow': {
              border: 'none !important',
              borderBottom: '1px solid #ccc !important'
            }
          }}
        />
        <Stack spacing={3}>
          {/* Type Pills */}
          <Box>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              {['Alert', 'Outage', 'Deadline', 'General'].map((type) => (
                <Button
                  key={type}
                  variant="contained"
                  size="medium"
                  disableElevation
                  disableRipple
                  onClick={() => handleFormChange('notification_type', type)}
                  sx={{
                    borderRadius: '20px',
                    px: 3,
                    py: 0.875,
                    minWidth: '85px',
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    bgcolor: `${NOTIFICATION_PILL_COLORS[type]} !important`,
                    color: `${NOTIFICATION_PILL_TEXT_COLORS[type]} !important`,
                    border:
                      formData.notification_type === type
                        ? `2px solid ${NOTIFICATION_PILL_TEXT_COLORS[type]}`
                        : 'none',
                    fontWeight: formData.notification_type === type ? 600 : 500,
                    transition: 'all 0.2s ease',
                    boxShadow: 'none !important',
                    '&:hover': {
                      bgcolor: `${NOTIFICATION_PILL_COLORS[type]} !important`,
                      border:
                        formData.notification_type === type
                          ? `2px solid ${NOTIFICATION_PILL_TEXT_COLORS[type]}`
                          : 'none',
                      filter: 'brightness(0.92)',
                      transform: 'translateY(-1px)',
                      boxShadow: 'none !important'
                    },
                    '&:active': {
                      bgcolor: `${NOTIFICATION_PILL_COLORS[type]} !important`,
                      border:
                        formData.notification_type === type
                          ? `2px solid ${NOTIFICATION_PILL_TEXT_COLORS[type]}`
                          : 'none',
                      boxShadow: 'none !important'
                    },
                    '&:focus': {
                      bgcolor: `${NOTIFICATION_PILL_COLORS[type]} !important`,
                      border:
                        formData.notification_type === type
                          ? `2px solid ${NOTIFICATION_PILL_TEXT_COLORS[type]}`
                          : 'none',
                      boxShadow: 'none !important'
                    },
                    '&:focus-visible': {
                      bgcolor: `${NOTIFICATION_PILL_COLORS[type]} !important`,
                      outline: 'none',
                      boxShadow: 'none !important'
                    }
                  }}
                >
                  {type}
                </Button>
              ))}
            </Stack>
          </Box>

          {/* Title */}
          <Box>
            <BCTypography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
              {t('dashboard:governmentNotifications.titleLabel')}
            </BCTypography>
            <TextField
              fullWidth
              required
              size="small"
              value={formData.notification_title}
              onChange={(e) =>
                handleFormChange('notification_title', e.target.value)
              }
              inputProps={{ maxLength: 200 }}
              placeholder={t(
                'dashboard:governmentNotifications.titlePlaceholder'
              )}
            />
          </Box>

          {/* Message */}
          <Box>
            <BCTypography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              {t('dashboard:governmentNotifications.messageLabel')}
            </BCTypography>
            <ReactQuill
              value={formData.notification_text}
              onChange={(value) => handleFormChange('notification_text', value)}
              theme="snow"
              modules={{
                toolbar: [
                  ['bold', 'italic'],
                  [{ list: 'bullet' }, { list: 'ordered' }],
                  ['link']
                ],
                keyboard: {
                  bindings: { tab: false }
                }
              }}
              formats={['bold', 'italic', 'list', 'bullet', 'link']}
              placeholder={t(
                'dashboard:governmentNotifications.messagePlaceholder'
              )}
            />
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <BCButton
              size="small"
              variant="outlined"
              color="primary"
              onClick={handleCancel}
            >
              {t('dashboard:governmentNotifications.cancel')}
            </BCButton>
            <BCButton
              size="small"
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={
                updateMutation.isPending ||
                !formData.notification_title ||
                isNotificationTextEmpty
              }
              isLoading={updateMutation.isPending}
            >
              {t('dashboard:governmentNotifications.post')}
            </BCButton>
          </Box>
        </Stack>
      </Box>
    )
  }

  const renderNotificationContent = () => {
    if (!notification) {
      return (
        <Box p={2}>
          <BCTypography
            variant="body2"
            color="text.secondary"
            textAlign="center"
          >
            {t('dashboard:governmentNotifications.emptyMessage')}
          </BCTypography>
        </Box>
      )
    }

    // Safely access notification properties with defaults (using camelCase from API)
    const notificationTitle =
      notification.notificationTitle ||
      t('dashboard:governmentNotifications.defaultTitle')
    const notificationText = notification.notificationText || ''
    const linkUrl = notification.linkUrl || ''

    const truncatedText =
      needsTruncation && !expanded
        ? notificationText.substring(0, 1000) + '...'
        : notificationText

    return (
      <Box p={2} sx={{ position: 'relative' }}>
        {/* Delete button in top-right corner */}
        {canEdit && (
          <Tooltip
            title={t(
              'dashboard:governmentNotifications.deleteNotificationTooltip'
            )}
          >
            <IconButton
              aria-label={t(
                'dashboard:governmentNotifications.deleteNotificationTooltip'
              )}
              onClick={handleDeleteClick}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                color: 'text.secondary',
                '&:hover': {
                  color: 'error.main',
                  backgroundColor: 'error.lighter'
                }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Title with optional link */}
        {linkUrl ? (
          <MuiLink
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            underline="always"
            sx={{
              fontWeight: 500,
              fontSize: '1rem',
              display: 'inline-block',
              mb: 1,
              color: 'primary.main',
              pr: canEdit ? 4 : 0, // Add padding to avoid overlap with delete button
              '&:link': {
                textDecoration: 'underline !important'
              }
            }}
          >
            {notificationTitle}
          </MuiLink>
        ) : (
          <BCTypography
            variant="h6"
            fontWeight="bold"
            sx={{ mb: 1, pr: canEdit ? 4 : 0 }}
          >
            {notificationTitle}
          </BCTypography>
        )}

        {/* Notification text */}
        <Box
          dangerouslySetInnerHTML={{
            __html: sanitizeNotificationHtml(truncatedText)
          }}
          sx={{
            fontSize: '1rem',
            '& p': { margin: 0, fontSize: '1rem' },
            '& ul, & ol': {
              marginTop: 0.5,
              marginBottom: 0.5,
              fontSize: '1rem'
            },
            '& a': {
              color: 'primary.main',
              textDecoration: 'underline !important',
              '&:hover': {
                cursor: 'pointer'
              }
            }
          }}
        />

        {/* Show more/less button if needed */}
        {needsTruncation && (
          <Button
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ mt: 1, textTransform: 'none' }}
          >
            {expanded
              ? t('dashboard:governmentNotifications.less')
              : t('dashboard:governmentNotifications.more')}
          </Button>
        )}
      </Box>
    )
  }

  return (
    <>
      <BCWidgetCard
        component="div"
        data-test={CARD_TEST_ID}
        title={cardTitle}
        content={isEditing ? renderEditForm() : renderNotificationContent()}
        headerSx={headerStyles}
        editButton={
          canEdit && !isEditing
            ? {
                id: 'edit-government-notification',
                text: t('dashboard:governmentNotifications.edit'),
                onClick: handleEditClick
              }
            : undefined
        }
        editButtonStyles={{
          borderColor: 'rgba(0, 0, 0 , 1)',
          color: 'rgba(0, 0, 0 , 1)'
        }}
      />

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={handleCancelConfirm}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            backgroundColor: '#003366',
            color: 'white',
            py: 2
          }}
        >
          {t('dashboard:governmentNotifications.confirmDialog.title')}
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2, mt: 2, ml: 4, mr: 4 }}>
          <BCTypography
            variant="body1"
            sx={{
              fontWeight: 'bold',
              color: '#d32f2f',
              mb: 2,
              textAlign: 'center'
            }}
          >
            {t('dashboard:governmentNotifications.confirmDialog.warning')}
          </BCTypography>
          <BCTypography variant="body1">
            {t('dashboard:governmentNotifications.confirmDialog.message')}
          </BCTypography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <BCButton
            size="small"
            variant="contained"
            color="primary"
            onClick={handleSaveWithoutEmail}
            disabled={updateMutation.isPending}
            isLoading={updateMutation.isPending}
          >
            {t(
              'dashboard:governmentNotifications.confirmDialog.postWithoutEmail'
            )}
          </BCButton>
          <BCButton
            size="small"
            variant="outlined"
            color="primary"
            onClick={handleSaveWithEmail}
            disabled={updateMutation.isPending}
          >
            {t('dashboard:governmentNotifications.confirmDialog.postWithEmail')}
          </BCButton>
          <BCButton
            size="small"
            variant="outlined"
            color="primary"
            onClick={handleCancelConfirm}
            disabled={updateMutation.isPending}
          >
            {t('dashboard:governmentNotifications.cancel')}
          </BCButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={handleCancelDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            backgroundColor: '#003366',
            color: 'white',
            py: 2
          }}
        >
          {t('dashboard:governmentNotifications.deleteDialog.title')}
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2, mt: 2 }}>
          <BCTypography variant="body1">
            {t('dashboard:governmentNotifications.deleteDialog.message')}
          </BCTypography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <BCButton
            size="small"
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
            isLoading={deleteMutation.isPending}
          >
            {t('dashboard:governmentNotifications.deleteDialog.confirm')}
          </BCButton>
          <BCButton
            size="small"
            variant="outlined"
            color="primary"
            onClick={handleCancelDelete}
            disabled={deleteMutation.isPending}
          >
            {t('dashboard:governmentNotifications.cancel')}
          </BCButton>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default GovernmentNotificationsCard
