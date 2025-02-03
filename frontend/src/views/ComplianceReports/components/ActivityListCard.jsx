import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import { useTranslation } from 'react-i18next'
import { ActivityLinksList } from './ActivityLinkList'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCButton from '@/components/BCButton'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import { useState } from 'react'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import Box from '@mui/material/Box'

export const ActivityListCard = ({ name, period, reportID }) => {
  const { t } = useTranslation(['report'])

  const [isOpen, setIsOpen] = useState(false)

  return (
    <BCWidgetCard
      component="div"
      style={{ height: 'fit-content' }}
      title={t('report:reportActivities')}
      sx={{ '& .MuiCardContent-root': { padding: '16px' } }}
      content={
        <BCBox
          sx={{
            marginTop: '5px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          <BCTypography
            variant="body4"
            color="text"
            component="div"
            dangerouslySetInnerHTML={{
              __html: t('report:activityHdrLabel', { name, period })
            }}
          />
          <Box>
            <ActivityLinksList />
          </Box>
          <Box>
            <BCTypography
              variant="body4"
              color="text"
              component="div"
              sx={{ paddingBottom: '8px' }}
            >
              {t('report:uploadLabel')}
            </BCTypography>
            <Box>
              <BCButton
                sx={{ marginLeft: '24px' }}
                data-test="submit-docs"
                size="small"
                className="svg-icon-button"
                variant="contained"
                color="primary"
                onClick={() => {
                  setIsOpen(true)
                }}
                startIcon={<FileUploadIcon />}
              >
                {t('report:supportingDocs')}
              </BCButton>
            </Box>
          </Box>
          <DocumentUploadDialog
            parentID={reportID}
            parentType="compliance_report"
            open={isOpen}
            close={() => {
              setIsOpen(false)
            }}
          />
        </BCBox>
      }
    />
  )
}
