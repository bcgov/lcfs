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

export const Comments = ({ comments }) => (
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
      {comments.map((comment) => (
        <>
          <ListItem alignItems="flex-start" sx={{ padding: '8px' }}>
            <ListItemAvatar>
              <Avatar>
                {comment.firstName.slice(0, 1)}
                {comment.lastName.slice(0, 1)}
              </Avatar>
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
                    {comment.firstName +
                      ' ' +
                      comment.lastName +
                      ', ' +
                      comment.organization +
                      ', ' +
                      comment.addDate}
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
                    {comment.message}
                  </Typography>
                </>
              }
            />
          </ListItem>
          <Divider variant="inset" component="li" />
        </>
      ))}
    </List>
  </BCBox>
)

Comments.propTypes = {
  comments: PropTypes.array.isRequired
}
