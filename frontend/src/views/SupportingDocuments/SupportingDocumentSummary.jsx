import Box from '@mui/material/Box'
import { List, ListItemButton } from '@mui/material'
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
          <ListItemButton
            sx={{ display: 'list-item', padding: '0', marginLeft: '1.2rem' }}
            component="a"
            key={file.documentId}
            alignItems="flex-start"
            onClick={() => {
              downloadDocument(file.documentId)
            }}
          >
            <BCTypography
              sx={{
                textDecoration: 'underline'
              }}
              variant="subtitle2"
              color="link"
            >
              {file.fileName} - {timezoneFormatter({ value: file.createDate })}
              {file.createUser && !hasRoles('Supplier')
                ? ` - ${file.createUser}`
                : ''}
            </BCTypography>
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}
