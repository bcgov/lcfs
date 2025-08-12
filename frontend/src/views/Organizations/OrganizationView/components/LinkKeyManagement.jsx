import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Box,
  Skeleton
} from '@mui/material'
import {
  ContentCopy,
  Refresh,
  AddCircleOutline,
  Warning as WarningIcon
} from '@mui/icons-material'

import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import BCAlert from '@/components/BCAlert'
import { useTranslation } from 'react-i18next'
import {
  useAvailableFormTypes,
  useOrganizationLinkKeys,
  useGenerateLinkKey,
  useRegenerateLinkKey
} from '@/hooks/useOrganization'
import { copyToClipboard } from '@/utils/clipboard'

// Constants
const ALERT_DISPLAY_DURATION = 5000
const CLIPBOARD_FALLBACK_DELAY = 100

const ALERT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info'
}

// Utility functions
const normalizeFormId = (formId) => {
  if (formId == null) return null
  return typeof formId === 'string' ? parseInt(formId, 10) : formId
}

const normalizeKeyData = (keyData) => ({
  formId: keyData.form_id ?? keyData.formId ?? keyData.form?.id,
  formSlug: keyData.form_slug ?? keyData.formSlug ?? keyData.slug,
  linkKey: keyData.link_key ?? keyData.linkKey ?? keyData.key,
  createDate: keyData.create_date ?? keyData.createDate ?? keyData.created_at
})

const generateFormLink = (formSlug, linkKey) => {
  const baseUrl = window.location.origin
  return `${baseUrl}/forms/${formSlug}/${linkKey}`
}

export const LinkKeyManagement = ({ orgData, orgID }) => {
  const { t } = useTranslation(['common', 'org'])

  // State management
  const [selectedFormId, setSelectedFormId] = useState('')
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [alert, setAlert] = useState({
    show: false,
    message: '',
    severity: ALERT_TYPES.SUCCESS,
    key: 0
  })
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [linkKeyCache, setLinkKeyCache] = useState({})

  // Ref to track current alert timeout
  const alertTimeoutRef = useRef(null)

  // API hooks
  const {
    data: formTypes,
    isLoading: loadingFormTypes,
    error: formTypesError
  } = useAvailableFormTypes(orgID)

  const {
    data: linkKeysData,
    isLoading: loadingLinkKeys,
    error: linkKeysError,
    refetch
  } = useOrganizationLinkKeys(orgID)

  // Computed values
  const availableForms = useMemo(() => {
    if (!formTypes?.forms) return []
    return Object.entries(formTypes.forms).map(([id, form]) => ({
      id,
      name: form.name,
      slug: form.slug
    }))
  }, [formTypes?.forms])

  const normalizedLinkKeys = useMemo(() => {
    const keys = linkKeysData?.linkKeys ?? linkKeysData?.link_keys ?? []
    return keys.map(normalizeKeyData)
  }, [linkKeysData])

  const selectedForm = useMemo(() => {
    return availableForms.find((form) => form.id === selectedFormId)
  }, [availableForms, selectedFormId])

  // Alert management
  const showAlert = useCallback((message, severity = ALERT_TYPES.SUCCESS) => {
    // Clear any existing timeout to ignore previous alert
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current)
      alertTimeoutRef.current = null
    }

    // Show new alert immediately
    setAlert((prev) => ({
      show: true,
      message,
      severity,
      key: prev.key + 1
    }))

    // Set timeout for success alerts only
    if (severity === ALERT_TYPES.SUCCESS) {
      alertTimeoutRef.current = setTimeout(() => {
        setAlert((prev) => ({ ...prev, show: false }))
        alertTimeoutRef.current = null
      }, ALERT_DISPLAY_DURATION)
    }
  }, [])

  const hideAlert = useCallback(() => {
    // Clear timeout when manually hiding alert
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current)
      alertTimeoutRef.current = null
    }
    setAlert((prev) => ({ ...prev, show: false }))
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current)
      }
    }
  }, [])

  // Key management utilities
  const hasExistingKey = useCallback(
    (formId) => {
      if (!formId) return false

      const normalizedId = normalizeFormId(formId)
      const cached = linkKeyCache[normalizedId]

      if (cached?.linkKey) return true

      return normalizedLinkKeys.some(
        (key) => normalizeFormId(key.formId) === normalizedId && key.linkKey
      )
    },
    [linkKeyCache, normalizedLinkKeys]
  )

  const getExistingKey = useCallback(
    (formId) => {
      if (!formId) return null

      const normalizedId = normalizeFormId(formId)
      const cached = linkKeyCache[normalizedId]

      if (cached?.linkKey) return cached

      return normalizedLinkKeys.find(
        (key) => normalizeFormId(key.formId) === normalizedId && key.linkKey
      )
    },
    [linkKeyCache, normalizedLinkKeys]
  )

  // Cache management
  const updateCache = useCallback((formId, keyData) => {
    const normalizedId = normalizeFormId(formId)
    if (!normalizedId) return

    setLinkKeyCache((prev) => ({
      ...prev,
      [normalizedId]: keyData
    }))
  }, [])

  const clearCacheEntry = useCallback((formId) => {
    const normalizedId = normalizeFormId(formId)
    if (!normalizedId) return

    setLinkKeyCache((prev) => {
      const updated = { ...prev }
      delete updated[normalizedId]
      return updated
    })
  }, [])

  // Clipboard operations
  const handleCopyToClipboard = useCallback(
    async (link, formName) => {
      try {
        const success = await copyToClipboard(link)

        if (success) {
          showAlert(
            t('org:linkKeyManagement.linkSuccessfullyCopied', { formName })
          )
          return true
        }
        throw new Error('Clipboard operation failed')
      } catch (error) {
        console.error('Copy to clipboard failed:', error)
        showAlert(
          t('org:linkKeyManagement.failedToCopyLink'),
          ALERT_TYPES.ERROR
        )
        return false
      }
    },
    [showAlert, t]
  )

  // Event handlers
  const handleCopyLink = useCallback(async () => {
    const existingKey = getExistingKey(selectedFormId)

    if (existingKey?.formSlug && existingKey?.linkKey) {
      const link = generateFormLink(existingKey.formSlug, existingKey.linkKey)
      await handleCopyToClipboard(link, selectedForm.name)
    } else {
      generateMutation.mutate({ formId: normalizeFormId(selectedFormId) })
    }
  }, [
    selectedFormId,
    selectedForm,
    getExistingKey,
    handleCopyToClipboard,
    showAlert
  ])

  const handleRegenerate = useCallback(() => {
    setShowRegenerateDialog(true)
  }, [selectedFormId, hasExistingKey, showAlert])

  const confirmRegenerate = useCallback(() => {
    if (!selectedFormId) return

    setIsRegenerating(true)
    setShowRegenerateDialog(false)
    regenerateMutation.mutate(normalizeFormId(selectedFormId))
  }, [selectedFormId])

  // Mutation success handlers
  const handleGenerateSuccess = useCallback(
    async (data) => {
      const responseData = data.data ?? data
      const normalizedData = normalizeKeyData(responseData)
      const formName = selectedForm?.name ?? 'Unknown Form'

      await refetch()

      if (normalizedData.formSlug && normalizedData.linkKey) {
        updateCache(selectedFormId, normalizedData)

        const link = generateFormLink(
          normalizedData.formSlug,
          normalizedData.linkKey
        )
        const copySuccess = await handleCopyToClipboard(link, formName)

        if (!copySuccess) {
          showAlert(t('org:linkKeyManagement.linkKeyGenerated', { formName }))
        }
      } else {
        showAlert(t('org:linkKeyManagement.linkKeyGenerated', { formName }))
      }
    },
    [
      selectedForm,
      selectedFormId,
      refetch,
      updateCache,
      handleCopyToClipboard,
      showAlert,
      t
    ]
  )

  const handleGenerateError = useCallback(
    (error) => {
      const errorMessage =
        error.response?.data?.detail ?? error.message ?? 'Unknown error'

      if (errorMessage.includes('already exists')) {
        setTimeout(async () => {
          await refetch()
          const existingKey = getExistingKey(selectedFormId)

          if (existingKey?.formSlug && existingKey?.linkKey && selectedForm) {
            const link = generateFormLink(
              existingKey.formSlug,
              existingKey.linkKey
            )
            await handleCopyToClipboard(link, selectedForm.name)
          } else {
            showAlert(
              t('org:linkKeyManagement.keyExistsButNotRetrieved'),
              ALERT_TYPES.ERROR
            )
          }
        }, CLIPBOARD_FALLBACK_DELAY)
      } else {
        showAlert(
          t('org:linkKeyManagement.errorGeneratingLinkKey', { errorMessage }),
          ALERT_TYPES.ERROR
        )
      }
    },
    [
      refetch,
      getExistingKey,
      selectedFormId,
      selectedForm,
      handleCopyToClipboard,
      showAlert,
      t
    ]
  )

  const handleRegenerateSuccess = useCallback(async () => {
    const formName = selectedForm?.name ?? 'Unknown Form'

    clearCacheEntry(selectedFormId)
    await refetch()

    showAlert(
      t('org:linkKeyManagement.linkSuccessfullyRefreshed', { formName })
    )
    setIsRegenerating(false)
  }, [selectedForm, selectedFormId, clearCacheEntry, refetch, showAlert, t])

  const handleRegenerateError = useCallback(
    (error) => {
      const errorMessage =
        error.response?.data?.detail ?? error.message ?? 'Unknown error'

      showAlert(
        t('org:linkKeyManagement.errorRegeneratingLinkKey', { errorMessage }),
        ALERT_TYPES.ERROR
      )
      setIsRegenerating(false)
    },
    [showAlert, t]
  )

  // Mutation hooks
  const generateMutation = useGenerateLinkKey(orgID, {
    onSuccess: handleGenerateSuccess,
    onError: handleGenerateError
  })

  const regenerateMutation = useRegenerateLinkKey(orgID, {
    onSuccess: handleRegenerateSuccess,
    onError: handleRegenerateError
  })

  // Effects
  useEffect(() => {
    const cacheUpdates = {}

    normalizedLinkKeys.forEach((key) => {
      if (key.formId && key.linkKey) {
        const normalizedId = normalizeFormId(key.formId)
        cacheUpdates[normalizedId] = {
          formSlug: key.formSlug,
          linkKey: key.linkKey,
          createDate: key.createDate
        }
      }
    })

    if (Object.keys(cacheUpdates).length > 0) {
      setLinkKeyCache((prev) => ({ ...prev, ...cacheUpdates }))
    }
  }, [normalizedLinkKeys])

  // Render helpers
  const renderLoadingState = () => (
    <BCBox>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <BCTypography variant="body4">
          <strong>{t('org:linkKeyManagement.externalFormLinks')}</strong>
        </BCTypography>
        <Skeleton variant="rectangular" width={200} height={40} />
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton variant="circular" width={40} height={40} />
      </Box>
    </BCBox>
  )

  const renderErrorState = () => (
    <BCBox>
      <BCAlert severity="error">
        {t('org:linkKeyManagement.failedToLoadData')}
      </BCAlert>
    </BCBox>
  )

  const renderEmptyState = () => (
    <BCBox>
      <BCTypography variant="body2" color="text.secondary">
        {t('org:linkKeyManagement.noFormsAvailable')}
      </BCTypography>
    </BCBox>
  )

  // Early returns for different states
  if (loadingFormTypes || loadingLinkKeys) {
    return renderLoadingState()
  }

  if (formTypesError || linkKeysError) {
    return renderErrorState()
  }

  if (availableForms.length === 0) {
    return renderEmptyState()
  }

  return (
    <BCBox>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <BCTypography variant="body4">
          <strong>{t('org:linkKeyManagement.externalFormLinks')}</strong>
        </BCTypography>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            displayEmpty
            variant="outlined"
            sx={{
              padding: '8px',
              borderRadius: 1
            }}
            aria-label={t('org:linkKeyManagement.selectFormAriaLabel')}
          >
            <MenuItem value="" disabled>
              {t('org:linkKeyManagement.selectLinkToCopy')}
            </MenuItem>
            {availableForms.map((form) => (
              <MenuItem key={form.id} value={form.id}>
                {form.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <IconButton
          onClick={handleCopyLink}
          disabled={!selectedFormId || generateMutation.isLoading}
          color="primary"
          size="medium"
          aria-label={
            hasExistingKey(selectedFormId)
              ? t('org:linkKeyManagement.copyExistingLinkAriaLabel')
              : t('org:linkKeyManagement.generateNewLinkAriaLabel')
          }
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {hasExistingKey(selectedFormId) ? (
            <ContentCopy />
          ) : (
            <AddCircleOutline />
          )}
          <BCTypography variant="body2">
            {hasExistingKey(selectedFormId)
              ? t('org:linkKeyManagement.copy')
              : t('org:linkKeyManagement.generate')}
          </BCTypography>
        </IconButton>

        <IconButton
          onClick={handleRegenerate}
          disabled={
            !selectedFormId ||
            !hasExistingKey(selectedFormId) ||
            regenerateMutation.isLoading ||
            isRegenerating
          }
          color="warning"
          size="medium"
          aria-label={t(
            'org:linkKeyManagement.regenerateExistingLinkAriaLabel'
          )}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Refresh />
          <BCTypography variant="body2">
            {t('org:linkKeyManagement.refresh')}
          </BCTypography>
        </IconButton>
      </Box>

      <Dialog
        open={showRegenerateDialog}
        onClose={() => setShowRegenerateDialog(false)}
        aria-labelledby="regenerate-dialog-title"
        aria-describedby="regenerate-dialog-description"
      >
        <DialogTitle
          id="regenerate-dialog-title"
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1
          }}
        >
          {t('org:linkKeyManagement.caution')}
          <WarningIcon sx={{ color: '#e69e10' }} />
        </DialogTitle>

        <DialogContent sx={{ pt: 2, mt: 2 }}>
          <DialogContentText
            id="regenerate-dialog-description"
            sx={{ textAlign: 'center' }}
          >
            <BCTypography variant="body2" sx={{ mb: 1 }}>
              <strong>{t('org:linkKeyManagement.regeneratingWarning')}</strong>
            </BCTypography>
            <BCTypography variant="body2">
              {t('org:linkKeyManagement.regeneratingInstruction')}
            </BCTypography>
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <BCButton
            variant="outlined"
            color="dark"
            onClick={() => setShowRegenerateDialog(false)}
          >
            {t('org:linkKeyManagement.cancel')}
          </BCButton>
          <BCButton
            variant="contained"
            color="primary"
            autoFocus
            onClick={confirmRegenerate}
            disabled={isRegenerating}
            isLoading={isRegenerating}
          >
            {t('org:linkKeyManagement.regenerateLink')}
          </BCButton>
        </DialogActions>
      </Dialog>

      {alert.show && (
        <BCAlert
          key={alert.key}
          severity={alert.severity}
          sx={{ mt: 2 }}
          onClose={alert.severity === ALERT_TYPES.ERROR ? hideAlert : undefined}
        >
          {alert.message}
        </BCAlert>
      )}
    </BCBox>
  )
}
