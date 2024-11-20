import Box from '@mui/material/Box'
import { List, ListItemButton } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { apiRoutes } from '@/constants/routes'
import { useApiService } from '@/services/useApiService'

export const SupportingDocumentSummary = ({ reportId, data }) => {
  const apiService = useApiService()

  const viewDocument = async (documentId) => {
    if (!reportId || !documentId) return
    const res = await apiService.get(
      apiRoutes.getDocument
        .replace(':parentType', 'compliance_report')
        .replace(':parentId', reportId)
        .replace(':documentId', documentId),
      {
        responseType: 'blob'
      }
    )
    const fileURL = URL.createObjectURL(res.data)
    window.open(fileURL, '_blank')
  }

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
              viewDocument(file.documentId)
            }}
          >
            <BCTypography
              sx={{
                textDecoration: 'underline'
              }}
              variant="subtitle2"
              color="link"
            >
              {file.fileName}
            </BCTypography>
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}
