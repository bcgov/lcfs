import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCButton from '@/components/BCButton'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import BCTypography from '@/components/BCTypography'

const UploadCard = ({ reportID }) => {
  const { t } = useTranslation(['report'])
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <BCWidgetCard
        component="div"
        style={{ height: 'fit-content' }}
        title={t('report:supportingDocs')}
        content={
          <>
            <BCTypography variant="body4" color="text">
              Upload supporting documents for your report.
            </BCTypography>
            <div>
              <BCButton
                data-test="submit-docs"
                size="large"
                variant="contained"
                color="primary"
                onClick={() => {
                  setIsOpen(true)
                }}
                startIcon={<FileUploadIcon />}
                sx={{ mt: 2 }}
              >
                {t('report:supportingDocs')}
              </BCButton>
            </div>
          </>
        }
      />
      <DocumentUploadDialog
        parentID={reportID}
        parentType="compliance_report"
        open={isOpen}
        close={() => {
          setIsOpen(false)
        }}
      />
    </>
  )
}

export default UploadCard
