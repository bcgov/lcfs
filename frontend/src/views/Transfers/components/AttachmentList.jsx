import PropTypes from 'prop-types'
import BCBox from '@/components/BCBox'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import BCTypography from '@/components/BCTypography'
import AttachFile from '@mui/icons-material/AttachFile'

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
            <AttachFile data-test="AttachFileIcon" sx={{ marginTop: '8px' }} />
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
