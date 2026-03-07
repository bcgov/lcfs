import { useEffect } from 'react'
import { Box, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslation } from 'react-i18next'
import { useAuthorization } from '@/contexts/AuthorizationContext'
import { router } from '@/routes'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'

const ERROR_CONTENT = {
  500: { code: '500', titleKey: 'internalServerError.title', messageKey: 'internalServerError.message' }
}

export const ErrorOverlay = () => {
  const { t } = useTranslation('common')
  const { errorStatus, errorRefs, setErrorStatus, clearErrorRefs, resetServerError } =
    useAuthorization()

  useEffect(() => router.subscribe(resetServerError), [])

  const handleClose = () => {
    setErrorStatus(null)
    clearErrorRefs()
  }

  if (!errorStatus) return null

  const { code, titleKey, messageKey } = ERROR_CONTENT[errorStatus] ?? {
    code: String(errorStatus),
    titleKey: null,
    messageKey: 'errorPage.genericMessage'
  }

  return (
    <Box
      onClick={handleClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)',
        backgroundColor: 'rgba(0,0,0,0.24)',
        px: 2
      }}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          border: '1px solid #d9d9d9',
          borderTop: '3px solid #003366',
          borderRadius: 1,
          maxWidth: 460,
          width: '100%',
          p: { xs: 3, sm: 4 },
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}
      >
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="close"
          sx={{ position: 'absolute', top: 10, right: 10, color: '#777' }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>

        <BCTypography
          variant="overline"
          sx={{ color: '#003366', fontWeight: 700, letterSpacing: 1, display: 'block', mb: 0.5 }}
        >
          Error {code}
        </BCTypography>

        {titleKey && (
          <BCTypography variant="h6" sx={{ fontWeight: 600, color: '#003366', mb: 1.5 }}>
            {t(titleKey)}
          </BCTypography>
        )}

        <BCTypography variant="body2" sx={{ color: '#444', lineHeight: 1.7, mb: 3 }}>
          {t(messageKey)}
        </BCTypography>

        {errorRefs.length > 0 && (
          <Box
            sx={{
              bgcolor: '#f7f8f9',
              border: '1px solid #e0e0e0',
              borderRadius: 1,
              px: 2,
              py: 1.5,
              mb: 3
            }}
          >
            <BCTypography
              variant="caption"
              sx={{
                color: '#777',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 700,
                display: 'block',
                mb: 0.75
              }}
            >
              {t(errorRefs.length > 1 ? 'errorPage.referenceNumbersLabel' : 'errorPage.referenceNumberLabel')}
            </BCTypography>
            {errorRefs.map((ref, index) => (
              <Box
                key={ref}
                component="code"
                sx={{
                  display: 'block',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: '#003366',
                  wordBreak: 'break-all',
                  mt: index > 0 ? 0.5 : 0
                }}
              >
                {errorRefs.length > 1 && `${index + 1}. `}{ref}
              </Box>
            ))}
            <BCTypography
              variant="caption"
              sx={{ color: '#777', display: 'block', mt: 1 }}
            >
              {t('errorPage.referenceNumberHint')}
            </BCTypography>
          </Box>
        )}

        <BCTypography variant="caption" sx={{ color: '#777', display: 'block', mb: 3 }}>
          {t('errorPage.contactSupport')}{' '}
          <a href={`mailto:${t('unauthorized.email')}`} style={{ color: '#003366' }}>
            {t('unauthorized.email')}
          </a>
        </BCTypography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <BCButton
            variant="contained"
            color="primary"
            onClick={handleClose}
            data-test="error-overlay-close-btn"
            sx={{ textTransform: 'none', fontWeight: 500, px: 3, py: 0.875 }}
          >
            {t('errorPage.closeAndContinue')}
          </BCButton>
          <BCTypography variant="caption" sx={{ color: '#999' }}>
            {t('errorPage.closeAndContinueHint')}
          </BCTypography>
        </Box>
      </Box>
    </Box>
  )
}
