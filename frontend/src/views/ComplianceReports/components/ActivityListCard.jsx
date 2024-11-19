import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import { Typography } from '@mui/material'
import Box from '@mui/material/Box'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityLinksList } from './ActivityLinkList'

export const ActivityListCard = ({ name, period, reportId }) => {
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
          <Typography
            variant="body4"
            color="text"
            component="div"
            dangerouslySetInnerHTML={{
              __html: t('report:activityHdrLabel', { name, period })
            }}
          />
          <Box>
            <Typography variant="body4" color="text" component="div">
              {t('report:activityLinksList')}:
            </Typography>
            <ActivityLinksList />
          </Box>
          <Box>
            <Typography
              variant="body4"
              color="text"
              component="div"
              sx={{ paddingBottom: '8px' }}
            >
              {t('report:uploadLabel')}
            </Typography>
            <Box>
              <BCButton
                sx={{ marginLeft: '24px' }}
                data-test="submit-docs"
                size="large"
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
            parentId={reportId}
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
