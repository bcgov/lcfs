import BCModal from '@/components/BCModal'
import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import DocumentTable from '@/components/Documents/DocumentTable.jsx'

function DocumentUploadDialog({ open, close, parentType, parentID }) {
  const { t } = useTranslation(['report'])
  const onClose = () => {
    close()
  }

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
        {t('report:documentLabel')}
      </BCTypography>
      <DocumentTable parentID={parentID} parentType={parentType} />
    </Box>
  )

  return (
    <BCModal
      onClose={onClose}
      open={open}
      data={{
        title: 'Upload supporting documents for your compliance report',
        secondaryButtonAction: onClose,
        secondaryButtonText: 'Return to compliance report',
        content
      }}
    ></BCModal>
  )
}

export default DocumentUploadDialog
