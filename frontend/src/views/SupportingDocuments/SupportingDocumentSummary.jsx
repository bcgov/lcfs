import Box from '@mui/material/Box'
import { List } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { useDownloadDocument } from '@/hooks/useDocuments.js'
import { timezoneFormatter } from '@/utils/formatters'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export const SupportingDocumentSummary = ({ parentID, parentType, data }) => {
  const downloadDocument = useDownloadDocument(parentType, parentID)
  const { hasRoles } = useCurrentUser()

  return (
    <Box>
      <List component="div" sx={{ maxWidth: '100%', listStyleType: 'disc' }}>
        {data.map((file) => (
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
              - {timezoneFormatter({ value: file.createDate })}
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
