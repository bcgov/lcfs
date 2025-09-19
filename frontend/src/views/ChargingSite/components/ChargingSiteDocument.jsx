import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  IconButton,
  List
} from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import colors from '@/themes/base/colors'
import { Edit, ExpandMore } from '@mui/icons-material'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import BCBox from '@/components/BCBox'
import { timezoneFormatter } from '@/utils/formatters'
import { useParams } from 'react-router-dom'
import { useDownloadDocument } from '@/hooks/useDocuments'
import DocumentUploadDialog from '@/components/Documents/DocumentUploadDialog'

const accordionStyles = {
  '& .Mui-disabled': {
    backgroundColor: colors.light.main,
    opacity: '0.8 !important',
    '& .MuiTypography-root': {
      color: 'initial !important'
    }
  }
}

// Temporary data:
const data = [
  {
    documentId: '1',
    fileName: '0032100321-001Hydrobill.pdf',
    createDate: '2023-01-01',
    createUser: 'John Doe'
  },
  {
    documentId: '2',
    fileName: 'test2.pdf',
    createDate: '2023-01-01',
    createUser: 'John Doe'
  }
]
export const ChargingSiteDocument = ({ attachments }) => {
  const { t } = useTranslation('chargingSite')
  const [expanded, setExpanded] = useState(
    attachments?.length ? 'document' : ''
  )
  const [isFileDialogOpen, setFileDialogOpen] = useState(false)
  const { chargingSiteId } = useParams()
  const downloadDocument = useDownloadDocument('charging_site', chargingSiteId)

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false)
  }
  // Handle attachments accordion toggle
  const handleAttachmentsAccordionChange = useCallback((event, isExpanded) => {
    setIsAttachmentsExpanded(isExpanded)
  }, [])

  const handleFileDialogOpen = useCallback(() => {
    setFileDialogOpen(true)
  }, [])
  const handleFileDialogClose = useCallback(() => {
    setFileDialogOpen(false)
  }, [])

  return (
    <>
      <Accordion
        expanded={expanded === 'document'}
        onChange={handleChange('document')}
        sx={accordionStyles}
      >
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ width: '2rem', height: '2rem' }} />}
          aria-controls="documentd-content"
          id="documentd-header"
          sx={{
            '& .MuiAccordionSummary-content': { alignItems: 'center' }
          }}
        >
          <BCTypography
            style={{ display: 'flex', alignItems: 'center' }}
            variant="h6"
            color="primary"
            component="div"
          >
            {t('documentTitle')}
            <Role
              roles={[
                roles.signing_authority,
                roles.compliance_reporting,
                roles.analyst
              ]}
            >
              <IconButton
                color="primary"
                label="edit"
                sx={{ px: 2 }}
                aria-label="edit"
                className="small-icon"
                onClick={(e) => {
                  e.stopPropagation()
                  handleFileDialogOpen()
                }}
              >
                <Edit />
              </IconButton>
            </Role>
          </BCTypography>
        </AccordionSummary>
        <AccordionDetails>
          <BCBox>
            <List
              component="div"
              sx={{ maxWidth: '100%', listStyleType: 'disc' }}
            >
              {attachments?.map((file) => (
                <BCBox
                  sx={{
                    display: 'list-item',
                    padding: '0',
                    marginLeft: '1.2rem'
                  }}
                  key={file.documentId}
                >
                  <BCTypography
                    component="span"
                    variant="subtitle2"
                    color="link"
                    onClick={() => {
                      downloadDocument(file.documentId)
                    }}
                    sx={{
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      '&:hover': { color: 'info.main' }
                    }}
                  >
                    {file.fileName}
                  </BCTypography>
                  <BCTypography
                    component="span"
                    variant="subtitle2"
                    sx={{ marginLeft: 1 }}
                  >
                    - {timezoneFormatter({ value: file.createDate })}{' '}
                    {file.createUser}
                  </BCTypography>
                </BCBox>
              ))}
            </List>
          </BCBox>
        </AccordionDetails>
      </Accordion>
      {/* Document Upload Dialog */}
      <DocumentUploadDialog
        parentID={chargingSiteId}
        parentType="charging_site"
        open={isFileDialogOpen}
        close={handleFileDialogClose}
      />
    </>
  )
}
