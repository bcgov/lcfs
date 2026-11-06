import { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Block from '@mui/icons-material/Block'
import VerifiedUser from '@mui/icons-material/VerifiedUser'
import WarningAmber from '@mui/icons-material/WarningAmber'

import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { roles } from '@/constants/roles'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useReviewDocumentScan } from '@/hooks/useDocuments'
import { getDocumentDisplayName, hasScanReview } from '@/utils/documents'

const FindingsList = ({ findings }) => (
  <Box component="ul" sx={{ m: 0, pl: 2 }}>
    {findings.map((finding) => (
      <li key={finding}>{finding}</li>
    ))}
  </Box>
)

FindingsList.propTypes = {
  findings: PropTypes.arrayOf(PropTypes.string).isRequired
}

/**
 * Inline macro review state for a document. Government users see what the
 * macro check found; IDIR Administrators can approve or reject the file
 * right here. Shows nothing for files without macros.
 */
const DocumentScanStatus = (props) =>
  hasScanReview(props.document) ? <ScanReview {...props} /> : null

const ScanReview = ({ document, parentType, parentID }) => {
  const { t } = useTranslation(['report'])
  const { data: currentUser, hasRoles } = useCurrentUser()
  const [decision, setDecision] = useState(null)
  const [reviewError, setReviewError] = useState('')
  const { mutateAsync: reviewScan } = useReviewDocumentScan(
    parentType,
    parentID
  )

  const status = document?.scanStatus
  const isGovernment = Boolean(currentUser?.isGovernmentUser)
  const isAdministrator = isGovernment && hasRoles(roles.administrator)
  const findings = document?.scanFindings || []

  const chips = {
    pending_approval: {
      label: isGovernment
        ? t('report:documentScan.awaitingApproval')
        : t('report:documentScan.underReview'),
      color: 'warning',
      icon: <WarningAmber />
    },
    rejected: {
      label: t('report:documentScan.rejected'),
      color: 'error',
      icon: <Block />
    },
    // Only staff need to know a file had macros once it's approved
    approved: isGovernment && {
      label: t('report:documentScan.approved'),
      color: 'success',
      icon: <VerifiedUser />
    }
  }
  const chip = chips[status]
  if (!chip) return null

  const fileName = getDocumentDisplayName(document)

  const handleConfirm = async () => {
    try {
      await reviewScan({ documentID: document.documentId, decision })
      setReviewError('')
    } catch {
      setReviewError(t('report:documentScan.reviewFailed'))
    }
    setDecision(null)
  }

  const chipElement = (
    <Chip
      size="small"
      variant={status === 'approved' ? 'outlined' : 'filled'}
      color={chip.color}
      icon={chip.icon}
      label={chip.label}
      data-test="document-scan-status"
    />
  )

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1,
        mt: 0.5
      }}
    >
      {isGovernment && findings.length > 0 ? (
        <Tooltip
          title={
            <>
              <BCTypography variant="caption" sx={{ fontWeight: 600 }}>
                {t('report:documentScan.findingsTitle')}
              </BCTypography>
              <FindingsList findings={findings} />
            </>
          }
        >
          {chipElement}
        </Tooltip>
      ) : (
        chipElement
      )}

      {isAdministrator && status === 'pending_approval' && (
        <>
          <BCButton
            size="small"
            variant="outlined"
            color="success"
            onClick={() => setDecision('approve')}
            data-test="document-scan-approve"
          >
            {t('report:documentScan.approve')}
          </BCButton>
          <BCButton
            size="small"
            variant="outlined"
            color="error"
            onClick={() => setDecision('reject')}
            data-test="document-scan-reject"
          >
            {t('report:documentScan.reject')}
          </BCButton>
        </>
      )}

      {reviewError && (
        <BCTypography variant="caption" color="error">
          {reviewError}
        </BCTypography>
      )}

      <BCModal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        data={{
          title:
            decision === 'approve'
              ? t('report:documentScan.approveTitle')
              : t('report:documentScan.rejectTitle'),
          content: (
            <>
              <BCTypography variant="body2" sx={{ mb: 1 }}>
                {decision === 'approve'
                  ? t('report:documentScan.approveText', { fileName })
                  : t('report:documentScan.rejectText', { fileName })}
              </BCTypography>
              {findings.length > 0 && (
                <>
                  <BCTypography variant="body2" sx={{ fontWeight: 600 }}>
                    {t('report:documentScan.findingsTitle')}
                  </BCTypography>
                  <BCTypography variant="body2" component="div">
                    <FindingsList findings={findings} />
                  </BCTypography>
                </>
              )}
            </>
          ),
          primaryButtonText:
            decision === 'approve'
              ? t('report:documentScan.approve')
              : t('report:documentScan.reject'),
          primaryButtonColor: decision === 'approve' ? 'primary' : 'error',
          primaryButtonAction: handleConfirm,
          secondaryButtonText: t('common:cancelBtn'),
          secondaryButtonAction: () => setDecision(null)
        }}
      />
    </Box>
  )
}

DocumentScanStatus.propTypes = {
  document: PropTypes.object.isRequired,
  parentType: PropTypes.string.isRequired,
  parentID: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
}

ScanReview.propTypes = DocumentScanStatus.propTypes

export default DocumentScanStatus
