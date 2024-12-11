import PropTypes from 'prop-types'
import BCBox from '@/components/BCBox'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import { List, ListItemButton, ListItemText } from '@mui/material'
import BCTypography from '@/components/BCTypography'

export const AttachmentList = ({ attachments = [] }) => {
  return (
    <BCBox mt={2}>
      <BCTypography variant="h6" color="primary">
        Attachments
      </BCTypography>
      <List sx={{ maxWidth: '30%' }}>
        {attachments.map((attachment) => (
          <ListItemButton
            component="a"
            key={attachment.attachmentID}
            alignItems="flex-start"
          >
            <AttachFileIcon
              data-test="AttachFileIcon"
              sx={{ marginTop: '8px' }}
            />
            <ListItemText
              secondary={attachment.fileName}
              sx={({ palette: { info } }) => ({
                '& p': { color: info.main, textDecoration: 'underline' }
              })}
            />
          </ListItemButton>
        ))}
      </List>
    </BCBox>
  )
}

AttachmentList.propTypes = {
  attachments: PropTypes.array.isRequired
}
