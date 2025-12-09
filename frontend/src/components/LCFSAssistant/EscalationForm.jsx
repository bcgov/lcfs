import { useState } from 'react'
import PropTypes from 'prop-types'
import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputLabel
} from '@mui/material'
import {
  Send as SendIcon,
  CheckCircleOutline as SuccessIcon,
  Headset as SupportIcon
} from '@mui/icons-material'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useApiService } from '@/services/useApiService'
import BCTypography from '@/components/BCTypography'
import {
  ChatHeader,
  HeaderBackButton,
  HeaderDivider
} from './components/ChatHeader'

const ISSUE_TYPES = [
  { value: 'question', label: 'General Question' },
  { value: 'issue', label: 'Report an Issue' },
  { value: 'feedback', label: 'Feedback' }
]

const FormField = ({ label, required, children }) => (
  <Box sx={{ mb: 2 }}>
    <InputLabel
      sx={{
        mb: 0.5,
        color: 'text.primary',
        fontSize: '0.875rem',
        fontWeight: 500
      }}
    >
      {label}
      {required && <span style={{ color: '#d32f2f' }}> *</span>}
    </InputLabel>
    {children}
  </Box>
)

FormField.propTypes = {
  label: PropTypes.string.isRequired,
  required: PropTypes.bool,
  children: PropTypes.node.isRequired
}

const EscalationForm = ({
  onClose,
  onCloseWidget,
  conversationHistory = [],
  isLowConfidence = false,
  isMaximized = false,
  onToggleMaximize,
  isMobile = false
}) => {
  const { data: currentUser } = useCurrentUser()
  const apiService = useApiService()

  const [formData, setFormData] = useState({
    issueType: '',
    description: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value
    }))
    if (submitStatus === 'error') {
      setSubmitStatus(null)
      setErrorMessage('')
    }
  }

  const isFormValid = () => {
    return (
      formData.issueType.trim() !== '' && formData.description.trim() !== ''
    )
  }

  const userName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
    : ''
  const userEmail = currentUser?.email || ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid()) return

    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      const formattedConversation = conversationHistory
        .map((msg) => {
          const role = msg.role === 'user' ? 'User' : 'Assistant'
          return `${role}: ${msg.content}`
        })
        .join('\n\n---\n\n')

      const payload = {
        issue_type: formData.issueType,
        description: formData.description,
        user_email: userEmail,
        user_name: userName,
        organization_name: currentUser?.organization?.name || 'Unknown',
        organization_id: currentUser?.organization?.organizationId,
        conversation_history: formattedConversation,
        is_low_confidence: isLowConfidence,
        submitted_at: new Date().toISOString()
      }

      await apiService.post('/chat/escalate', payload)
      setSubmitStatus('success')
    } catch (error) {
      console.error('Failed to submit escalation:', error)
      setSubmitStatus('error')
      setErrorMessage(
        error.response?.data?.detail ||
          'Failed to submit your request. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success state
  if (submitStatus === 'success') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          bgcolor: 'white'
        }}
      >
        {/* Header */}
        <ChatHeader
          title="Request Submitted"
          icon={SuccessIcon}
          bgcolor="#2e7d32"
          isDark
          isMaximized={isMaximized}
          isMobile={isMobile}
          onToggleMaximize={onToggleMaximize}
          onClose={onCloseWidget}
          rightActions={!isMobile && <HeaderDivider isDark />}
        />

        {/* Content */}
        <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: '#e8f5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2
              }}
            >
              <SuccessIcon sx={{ fontSize: 32, color: '#2e7d32' }} />
            </Box>

            <BCTypography variant="h6" sx={{ mb: 1 }}>
              Thank you!
            </BCTypography>

            <BCTypography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 3, lineHeight: 1.6 }}
            >
              Your request has been sent to our support team. We'll respond
              within <strong>5-10 business days</strong> at{' '}
              <strong>{userEmail}</strong>.
            </BCTypography>
          </Box>

          <Button
            variant="contained"
            onClick={onClose}
            fullWidth
            sx={{
              mt: 'auto',
              py: 1,
              bgcolor: '#003366',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                bgcolor: '#002244',
                color: '#fff'
              }
            }}
          >
            Return to Chat
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'white'
      }}
    >
      {/* Header */}
      <ChatHeader
        title="Contact Support"
        icon={SupportIcon}
        bgcolor="#003366"
        isDark
        isMaximized={isMaximized}
        isMobile={isMobile}
        onToggleMaximize={onToggleMaximize}
        onClose={onCloseWidget}
        rightActions={
          <>
            <HeaderBackButton onClick={onClose} isDark />
            <HeaderDivider isDark />
          </>
        }
      />

      {/* Scrollable Form Content */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          p: 2
        }}
      >
        {/* Info text */}
        <BCTypography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Please describe your issue and our support team will assist you.
        </BCTypography>

        {submitStatus === 'error' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* Form Fields */}
        <FormField label="Issue Type" required>
          <TextField
            select
            fullWidth
            size="small"
            value={formData.issueType}
            onChange={handleChange('issueType')}
            disabled={isSubmitting}
            variant="outlined"
            SelectProps={{ native: true }}
            sx={{
              bgcolor: '#fff'
            }}
          >
            <option value="" disabled>
              Select an issue type
            </option>
            {ISSUE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </TextField>
        </FormField>

        <FormField label="Describe your issue" required>
          <TextField
            multiline
            rows={6}
            value={formData.description}
            onChange={handleChange('description')}
            fullWidth
            size="small"
            disabled={isSubmitting}
            placeholder="Please describe your issue or question..."
            variant="outlined"
          />
        </FormField>

        {/* Info box */}
        <Box
          sx={{
            p: 1.5,
            mb: 2,
            bgcolor: '#f5f5f5',
            borderRadius: 1,
            border: '1px solid #e0e0e0'
          }}
        >
          <BCTypography
            variant="body2"
            sx={{ fontSize: '0.8rem', color: '#666' }}
          >
            <strong>Expected response:</strong> 5-10 business days
          </BCTypography>
          {conversationHistory.length > 0 && (
            <BCTypography
              variant="body2"
              sx={{ fontSize: '0.8rem', color: '#666', mt: 0.5 }}
            >
              <strong>Note:</strong> {conversationHistory.length} message(s)
              from your conversation will be included
            </BCTypography>
          )}
        </Box>

        {/* Buttons */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 'auto' }}>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={isSubmitting}
            sx={{
              flex: 1,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: '#d1d5db',
              color: '#4b5563',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#9ca3af',
                bgcolor: '#f9fafb',
                color: '#1f2937'
              },
              '&.Mui-disabled': {
                borderColor: '#e5e7eb',
                color: '#9ca3af'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!isFormValid() || isSubmitting}
            startIcon={
              isSubmitting ? (
                <CircularProgress size={16} sx={{ color: '#fff' }} />
              ) : (
                <SendIcon />
              )
            }
            sx={{
              flex: 1,
              py: 1,
              bgcolor: '#003366',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: '#002244',
                color: '#fff'
              },
              '&.Mui-disabled': {
                bgcolor: '#d1d5db !important',
                color: '#6b7280 !important',
                cursor: 'not-allowed'
              }
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

EscalationForm.propTypes = {
  onClose: PropTypes.func.isRequired,
  onCloseWidget: PropTypes.func.isRequired,
  conversationHistory: PropTypes.array,
  isLowConfidence: PropTypes.bool,
  isMaximized: PropTypes.bool,
  onToggleMaximize: PropTypes.func,
  isMobile: PropTypes.bool
}

export default EscalationForm
