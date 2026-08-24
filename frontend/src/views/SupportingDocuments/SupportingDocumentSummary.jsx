import Box from '@mui/material/Box'
import { List } from '@mui/material'
import prettyBytes from 'pretty-bytes'
import { useTranslation } from 'react-i18next'
import BCTypography from '@/components/BCTypography'
import { useDownloadDocument } from '@/hooks/useDocuments.js'
import { timezoneFormatter } from '@/utils/formatters'
import { useCurrentUser } from '@/hooks/useCurrentUser'

// `detailed` adds the file size and the uploading organization's code to
// each row (initiative agreement wireframes); other callers keep the
// original compact line.
export const SupportingDocumentSummary = ({
  parentID,
  parentType,
  data,
  detailed = false
}) => {
  const { t } = useTranslation(['common'])
  const downloadDocument = useDownloadDocument(parentType, parentID)
  const { hasRoles } = useCurrentUser()
  const files = Array.isArray(data) ? data : []

  return (
    <Box>
      <List component="div" sx={{ maxWidth: '100%', listStyleType: 'disc' }}>
        {files.map((file) => (
          <Box
            sx={{ display: 'list-item', padding: '0', marginLeft: '1.2rem' }}
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
              {detailed
                ? `- ${prettyBytes(file.fileSize ?? 0)} - ${
                    file.uploadingOrganizationCode || t('gov')
                  } - ${timezoneFormatter({ value: file.createDate })}`
                : `- ${timezoneFormatter({ value: file.createDate })}`}
              {file.createUser && !hasRoles('Supplier')
                ? ` - ${file.createUser}`
                : ''}
            </BCTypography>
          </Box>
        ))}
      </List>
    </Box>
  )
}
