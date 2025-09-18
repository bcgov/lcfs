import BCModal from '@/components/BCModal'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import DocumentTable from '@/components/Documents/DocumentTable.jsx'

function DocumentUploadDialog({ open, close, parentType, parentID }) {
  const { t } = useTranslation(['report', 'chargingSite'])
  const onClose = () => {
    close()
  }
  // Get dynamic text based on parent type
  const getModalTexts = () => {
    switch (parentType) {
      case 'charging_site':
        return {
          title: t('chargingSite:documents.uploadTitle'),
          documentLabel: t('chargingSite:documents.documentLabel'),
          returnButton: t('chargingSite:documents.returnButton')
        }
      case 'compliance_report':
      default:
        return {
          title: t('report:documents.uploadTitle'),
          documentLabel: t('report:documentLabel'),
          returnButton: t('report:documents.returnButton')
        }
    }
  }

  const modalTexts = getModalTexts()

  // Get dynamic text based on parent type
  const getModalTexts = () => {
    switch (parentType) {
      case 'charging_site':
        return {
          title: t('chargingSite:documents.uploadTitle'),
          documentLabel: t('chargingSite:documents.documentLabel'),
          returnButton: t('chargingSite:documents.returnButton')
        }
      case 'compliance_report':
      default:
        return {
          title: t('report:documents.uploadTitle'),
          documentLabel: t('report:documentLabel'),
          returnButton: t('report:documents.returnButton')
        }
    }
  }

  const modalTexts = getModalTexts()

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <BCTypography variant="body2" style={{ marginTop: '10px' }}>
        {modalTexts.documentLabel}
      </BCTypography>
      <DocumentTable parentID={parentID} parentType={parentType} />
    </Box>
  )

  return (
    <BCModal
      onClose={onClose}
      open={open}
      data={{
        title: modalTexts.title,
        secondaryButtonAction: onClose,
        secondaryButtonText: modalTexts.returnButton,
        content
      }}
    ></BCModal>
  )
}

export default DocumentUploadDialog
