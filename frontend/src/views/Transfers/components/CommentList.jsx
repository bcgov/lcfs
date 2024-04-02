import BCBox from '@/components/BCBox'
import PropTypes from 'prop-types'
import {
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider
} from '@mui/material'

export const CommentList = ({ comments }) => (
  <BCBox mt={2}>
    <Typography variant="h6" color="primary">
      Comments
    </Typography>
    <List
      aria-label="comments section"
      sx={{
        marginTop: '4px',
        maxWidth: '100%',
        padding: '4px',
        borderRadius: '5px'
      }}
    >
      {comments?.map((comment, idx) => (
        <BCBox component="div" key={idx}>
          <ListItem alignItems="flex-start" sx={{ padding: '8px' }}>
            <ListItemAvatar>
              <Avatar>{comment.name.slice(0, 1)}</Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <>
                  <Typography
                    sx={{ display: 'inline' }}
                    component="span"
                    variant="subtitle1"
                    color="text.primary"
                  >
                    {comment.name}
                    {':'}
                  </Typography>
                </>
              }
              secondary={
                <>
                  <Typography
                    sx={{ display: 'inline' }}
                    component="span"
                    variant="body4"
                    color="text.primary"
                  >
                    {comment.comment}
                  </Typography>
                </>
              }
            />
          </ListItem>
          <Divider variant="inset" component="li" />
        </BCBox>
      ))}
    </List>
  </BCBox>
)

CommentList.propTypes = {
  comments: PropTypes.array.isRequired
}
